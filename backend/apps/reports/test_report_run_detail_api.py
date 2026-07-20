from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project

from .models import ReportRun, TestExecution


class ReportRunDetailApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="detail-owner")
        self.other_user = user_model.objects.create_user(username="other-detail-owner")
        self.project = Project.objects.create(
            name="Detail Project",
            owner=self.user,
        )
        self.other_project = Project.objects.create(
            name="Other Detail Project",
            owner=self.other_user,
        )
        self.report_run = self._create_run(self.project, "detail-report.json")
        self.execution = TestExecution.objects.create(
            report_run=self.report_run,
            external_id="test-suite;successful-login",
            feature="Login",
            suite="",
            scenario="successful login",
            status=TestExecution.Status.PASSED,
            duration=1.25,
            tags=["@smoke"],
            file_path="features/login.feature",
            line_number=14,
            retry_count=0,
        )
        self.url = reverse("reports:report-run-detail", args=[self.report_run.pk])

    def _create_run(self, project, filename):
        return ReportRun.objects.create(
            project=project,
            uploaded_by=project.owner,
            framework=ReportRun.Framework.CUCUMBER,
            raw_file=f"reports/{filename}",
            original_filename=filename,
            status=ReportRun.Status.COMPLETED,
            total_tests=1,
            passed_tests=1,
            failed_tests=0,
            skipped_tests=0,
            total_duration=1.25,
            parser_version="cucumber-json-v1",
        )

    def test_authenticated_owner_receives_report_detail(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                "id",
                "framework",
                "status",
                "original_filename",
                "total_tests",
                "passed_tests",
                "failed_tests",
                "skipped_tests",
                "total_duration",
                "uploaded_by",
                "created_at",
                "project",
                "raw_file",
                "parser_version",
                "error_message",
                "updated_at",
                "executions",
            },
        )

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_report_returns_404(self):
        self.client.force_authenticate(self.user)
        missing_url = reverse("reports:report-run-detail", args=[999999])

        response = self.client.get(missing_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_another_users_report_returns_404(self):
        other_report = self._create_run(self.other_project, "private-report.json")
        self.client.force_authenticate(self.user)
        other_url = reverse("reports:report-run-detail", args=[other_report.pk])

        response = self.client.get(other_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_nested_executions_are_included(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["executions"]), 1)
        self.assertEqual(
            set(response.data["executions"][0]),
            {
                "id",
                "external_id",
                "feature",
                "suite",
                "scenario",
                "status",
                "duration",
                "error_message",
                "tags",
                "file_path",
                "line_number",
                "retry_count",
                "started_at",
                "finished_at",
                "created_at",
            },
        )
        self.assertEqual(response.data["executions"][0]["id"], self.execution.pk)
        self.assertEqual(response.data["executions"][0]["scenario"], "successful login")

    def test_requested_report_is_returned(self):
        second_report = self._create_run(self.project, "second-report.json")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.report_run.pk)
        self.assertNotEqual(response.data["id"], second_report.pk)
        self.assertEqual(response.data["original_filename"], "detail-report.json")
