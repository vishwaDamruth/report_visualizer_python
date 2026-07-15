from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project

from .models import ReportRun


class ProjectReportRunListApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="history-owner")
        self.other_user = user_model.objects.create_user(username="other-history-owner")
        self.project = Project.objects.create(
            name="History Project",
            created_by=self.user,
        )
        self.second_project = Project.objects.create(
            name="Second Project",
            created_by=self.user,
        )
        self.other_project = Project.objects.create(
            name="Other User Project",
            created_by=self.other_user,
        )
        self.url = reverse(
            "reports:project-report-run-list",
            args=[self.project.pk],
        )

    def _create_run(self, project, filename, **overrides):
        values = {
            "project": project,
            "uploaded_by": project.created_by,
            "framework": ReportRun.Framework.CUCUMBER,
            "raw_file": f"reports/{filename}",
            "original_filename": filename,
            "status": ReportRun.Status.COMPLETED,
            "total_tests": 3,
            "passed_tests": 2,
            "failed_tests": 1,
            "skipped_tests": 0,
            "total_duration": 4.5,
        }
        values.update(overrides)
        return ReportRun.objects.create(**values)

    def test_authenticated_owner_receives_report_runs(self):
        report_run = self._create_run(self.project, "run.json")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            set(response.data[0]),
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
            },
        )
        self.assertEqual(response.data[0]["id"], report_run.pk)
        self.assertEqual(response.data[0]["uploaded_by"], self.user.username)

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_another_users_project_returns_404(self):
        self.client.force_authenticate(self.user)
        other_project_url = reverse(
            "reports:project-report-run-list",
            args=[self.other_project.pk],
        )

        response = self.client.get(other_project_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_only_requested_projects_runs_are_returned(self):
        expected_run = self._create_run(self.project, "expected.json")
        self._create_run(self.second_project, "second-project.json")
        self._create_run(self.other_project, "other-user.json")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [expected_run.pk],
        )

    def test_runs_are_ordered_newest_first(self):
        older_run = self._create_run(self.project, "older.json")
        newer_run = self._create_run(self.project, "newer.json")
        now = timezone.now()
        ReportRun.objects.filter(pk=older_run.pk).update(
            created_at=now - timedelta(hours=1)
        )
        ReportRun.objects.filter(pk=newer_run.pk).update(created_at=now)
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [newer_run.pk, older_run.pk],
        )
