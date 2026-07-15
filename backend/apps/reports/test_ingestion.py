import hashlib
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.projects.models import Project

from .models import ReportRun, TestExecution
from .services import ReportIngestionError, ReportIngestionService
from .services.parsers import ReportParserError


class ReportIngestionServiceTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        fixture_path = Path(__file__).parent / "test_fixtures" / "cucumber-report.json"
        cls.fixture_content = fixture_path.read_bytes()

    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, True)

        self.user = get_user_model().objects.create_user(
            username="ingestion-owner",
            password="test-password",
        )
        self.project = Project.objects.create(
            name="Ingestion Project",
            created_by=self.user,
        )

    def _uploaded_fixture(self, name="cucumber-report.json"):
        return SimpleUploadedFile(name, self.fixture_content, content_type="application/json")

    def test_ingests_fixture_and_calculates_hash_and_summary(self):
        report_run = ReportIngestionService.ingest(
            self.project,
            self.user,
            self._uploaded_fixture(),
        )
        report_run.refresh_from_db()

        self.assertEqual(report_run.status, ReportRun.Status.COMPLETED)
        self.assertEqual(report_run.framework, ReportRun.Framework.CUCUMBER)
        self.assertEqual(report_run.file_hash, hashlib.sha256(self.fixture_content).hexdigest())
        self.assertEqual(report_run.total_tests, 3)
        self.assertEqual(report_run.passed_tests, 1)
        self.assertEqual(report_run.failed_tests, 1)
        self.assertEqual(report_run.skipped_tests, 1)
        self.assertEqual(report_run.total_duration, 9.0)
        self.assertEqual(report_run.executions.count(), 3)
        self.assertTrue(report_run.raw_file.storage.exists(report_run.raw_file.name))

    def test_rejects_invalid_files_before_creating_a_run(self):
        invalid_files = [
            None,
            SimpleUploadedFile("report.txt", b"{}", content_type="text/plain"),
            SimpleUploadedFile("report.json", b"", content_type="application/json"),
        ]

        for invalid_file in invalid_files:
            with self.subTest(file=invalid_file):
                with self.assertRaises(ReportIngestionError):
                    ReportIngestionService.ingest(self.project, self.user, invalid_file)

        self.assertEqual(ReportRun.objects.count(), 0)

    @override_settings(REPORT_UPLOAD_MAX_SIZE=10)
    def test_rejects_file_over_configured_size_limit(self):
        oversized_file = SimpleUploadedFile("report.json", b"{" + (b" " * 20) + b"}")

        with self.assertRaisesRegex(ReportIngestionError, "size limit"):
            ReportIngestionService.ingest(self.project, self.user, oversized_file)

        self.assertEqual(ReportRun.objects.count(), 0)

    def test_invalid_json_marks_run_failed_and_retains_raw_file(self):
        uploaded_file = SimpleUploadedFile("broken.json", b"{not valid json")

        with self.assertRaises(ReportIngestionError) as raised:
            ReportIngestionService.ingest(self.project, self.user, uploaded_file)

        report_run = raised.exception.report_run
        report_run.refresh_from_db()
        self.assertEqual(report_run.status, ReportRun.Status.FAILED)
        self.assertEqual(report_run.error_message, "The uploaded file is not valid JSON.")
        self.assertEqual(report_run.executions.count(), 0)
        self.assertTrue(report_run.raw_file.storage.exists(report_run.raw_file.name))

    def test_parser_error_is_sanitized_and_retained(self):
        class FailingParser:
            def parse(self, payload):
                raise ReportParserError("Unsupported\x1b[31m format\nwith control text")

        with self.assertRaises(ReportIngestionError) as raised:
            ReportIngestionService.ingest(
                self.project,
                self.user,
                self._uploaded_fixture(),
                parser=FailingParser(),
            )

        report_run = raised.exception.report_run
        self.assertEqual(report_run.status, ReportRun.Status.FAILED)
        self.assertEqual(report_run.error_message, "Unsupported format with control text")
        self.assertNotIn("\x1b", report_run.error_message)

    def test_database_failure_rolls_back_partial_executions_and_marks_run_failed(self):
        def partially_create_then_fail(executions):
            first = executions[0]
            TestExecution.objects.create(
                report_run=first.report_run,
                scenario=first.scenario,
                status=first.status,
            )
            raise RuntimeError("database details must not escape")

        with patch.object(TestExecution.objects, "bulk_create", side_effect=partially_create_then_fail):
            with self.assertRaises(ReportIngestionError) as raised:
                ReportIngestionService.ingest(
                    self.project,
                    self.user,
                    self._uploaded_fixture(),
                )

        report_run = raised.exception.report_run
        report_run.refresh_from_db()
        self.assertEqual(report_run.status, ReportRun.Status.FAILED)
        self.assertEqual(report_run.error_message, "The report could not be processed.")
        self.assertEqual(report_run.executions.count(), 0)

    def test_original_filename_is_reduced_to_basename(self):
        uploaded_file = self._uploaded_fixture("nested/path/report.json")

        report_run = ReportIngestionService.ingest(self.project, self.user, uploaded_file)

        self.assertEqual(report_run.original_filename, "report.json")
