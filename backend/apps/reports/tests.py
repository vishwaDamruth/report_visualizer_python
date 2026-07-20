import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.projects.models import Project

from .models import ReportRun, TestExecution, report_upload_path
from .serializers import ReportRunDetailSerializer, ReportRunListSerializer
from .services.parsers import CucumberJsonParser, ReportParserError


class ReportsFoundationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="report-owner",
            password="test-password",
        )
        self.project = Project.objects.create(
            name="Checkout Automation",
            owner=self.user,
        )
        self.report_run = ReportRun.objects.create(
            project=self.project,
            uploaded_by=self.user,
            framework=ReportRun.Framework.PLAYWRIGHT,
            raw_file="reports/test-report.json",
            original_filename="test-report.json",
        )

    def test_report_run_defaults_support_processing_pipeline(self):
        self.assertEqual(self.report_run.status, ReportRun.Status.PENDING)
        self.assertEqual(self.report_run.total_tests, 0)
        self.assertEqual(self.report_run.executions.count(), 0)

    def test_execution_is_related_to_run_and_cascades_on_delete(self):
        execution = TestExecution.objects.create(
            report_run=self.report_run,
            scenario="Successful checkout",
            status=TestExecution.Status.PASSED,
            tags=["@smoke"],
        )

        self.assertEqual(self.report_run.executions.get(), execution)
        self.report_run.delete()
        self.assertFalse(TestExecution.objects.filter(pk=execution.pk).exists())

    def test_serializers_expose_server_owned_summary_and_executions(self):
        TestExecution.objects.create(
            report_run=self.report_run,
            scenario="Successful checkout",
            status=TestExecution.Status.PASSED,
        )

        list_data = ReportRunListSerializer(self.report_run).data
        detail_data = ReportRunDetailSerializer(self.report_run).data

        self.assertEqual(list_data["uploaded_by"], self.user.username)
        self.assertEqual(detail_data["project"], self.project.pk)
        self.assertEqual(len(detail_data["executions"]), 1)

    def test_upload_path_is_project_scoped_and_collision_safe(self):
        first_path = report_upload_path(self.report_run, "../report.json")
        second_path = report_upload_path(self.report_run, "../report.json")

        self.assertTrue(first_path.startswith(f"reports/project_{self.project.pk}/"))
        self.assertTrue(first_path.endswith("_report.json"))
        self.assertNotEqual(first_path, second_path)


class CucumberJsonParserTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        fixture_path = Path(__file__).parent / "test_fixtures" / "cucumber-report.json"
        with fixture_path.open(encoding="utf-8") as fixture_file:
            cls.fixture = json.load(fixture_file)

    def setUp(self):
        self.parser = CucumberJsonParser()

    def test_parses_fixture_into_normalized_report(self):
        report = self.parser.parse(self.fixture)

        self.assertEqual(report.framework, "CUCUMBER")
        self.assertEqual(report.duration_unit, "seconds")
        self.assertEqual(len(report.executions), 3)

        passed, failed, skipped = report.executions
        self.assertEqual(passed.status, "PASSED")
        self.assertEqual(passed.duration, 4.0)
        self.assertEqual(passed.tags, ["@web", "@smoke"])
        self.assertEqual(passed.file_path, "features\\test.feature")
        self.assertEqual(passed.line_number, 14)

        self.assertEqual(failed.status, "FAILED")
        self.assertEqual(failed.retry_count, 1)
        self.assertIn("dashboard URL", failed.error_message)
        self.assertEqual(failed.started_at.isoformat(), "2026-07-14T12:00:00+00:00")
        self.assertEqual(failed.finished_at.isoformat(), "2026-07-14T12:00:05+00:00")

        self.assertEqual(skipped.status, "SKIPPED")
        self.assertEqual(skipped.duration, 0.0)
        self.assertIsNone(skipped.started_at)
        self.assertIsNone(skipped.finished_at)

    def test_hidden_hook_failure_marks_scenario_failed_and_preserves_error(self):
        report_data = [
            {
                "name": "Hooks",
                "uri": "features/hooks.feature",
                "elements": [
                    {
                        "name": "hook failure",
                        "steps": [
                            {
                                "keyword": "Before",
                                "hidden": True,
                                "result": {
                                    "status": "failed",
                                    "duration": 1_000_000,
                                    "error_message": "Setup failed",
                                },
                            }
                        ],
                    }
                ],
            }
        ]

        execution = self.parser.parse(report_data).executions[0]

        self.assertEqual(execution.status, "FAILED")
        self.assertEqual(execution.duration, 0.001)
        self.assertEqual(execution.error_message, "Before: Setup failed")

    def test_rejects_empty_or_structurally_invalid_reports(self):
        invalid_reports = ([], {}, [{"name": "Feature"}], [{"elements": []}])

        for invalid_report in invalid_reports:
            with self.subTest(report=invalid_report):
                with self.assertRaises(ReportParserError):
                    self.parser.parse(invalid_report)
