import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project

from .models import ReportRun, TestExecution
from .services import ReportIngestionError


class ReportUploadApiTests(APITestCase):
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

        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="upload-owner",
            password="test-password",
        )
        self.other_user = user_model.objects.create_user(
            username="other-owner",
            password="test-password",
        )
        self.project = Project.objects.create(
            name="Upload Project",
            owner=self.user,
        )
        self.url = reverse("reports:report-upload", args=[self.project.pk])

    def _report_file(self, content=None, name="cucumber-report.json"):
        return SimpleUploadedFile(
            name,
            content if content is not None else self.fixture_content,
            content_type="application/json",
        )

    def test_authenticated_owner_can_upload_report(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {"file": self._report_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], ReportRun.Status.COMPLETED)
        self.assertEqual(response.data["total_tests"], 3)
        self.assertEqual(response.data["passed_tests"], 1)
        self.assertEqual(response.data["failed_tests"], 1)
        self.assertEqual(response.data["skipped_tests"], 1)
        self.assertEqual(len(response.data["executions"]), 3)
        self.assertEqual(ReportRun.objects.count(), 1)
        self.assertEqual(TestExecution.objects.count(), 3)

    def test_invalid_json_returns_400_and_failed_run(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {"file": self._report_file(b"{not valid json", "broken.json")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data, {"error": "The uploaded file is not valid JSON."})
        self.assertEqual(ReportRun.objects.get().status, ReportRun.Status.FAILED)

    def test_unsupported_schema_returns_400(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {"file": self._report_file(b'{"unexpected": true}')},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            {"error": "Cucumber report must be a non-empty feature array."},
        )
        self.assertEqual(ReportRun.objects.get().status, ReportRun.Status.FAILED)

    def test_unauthenticated_request_returns_401(self):
        response = self.client.post(
            self.url,
            {"file": self._report_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(ReportRun.objects.count(), 0)

    def test_user_cannot_upload_to_another_users_project(self):
        self.client.force_authenticate(self.other_user)

        response = self.client.post(
            self.url,
            {"file": self._report_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(ReportRun.objects.count(), 0)

    @patch("apps.reports.views.ReportIngestionService.ingest")
    def test_parser_failure_returns_sanitized_400(self, ingest):
        ingest.side_effect = ReportIngestionError("Unsupported automation report format.")
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url,
            {"file": self._report_file()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            {"error": "Unsupported automation report format."},
        )
