from datetime import datetime, timedelta, timezone as datetime_timezone

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
        self.assertEqual(set(response.data), {"count", "next", "previous", "results"})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(
            set(response.data["results"][0]),
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
        self.assertEqual(response.data["results"][0]["id"], report_run.pk)
        self.assertEqual(
            response.data["results"][0]["uploaded_by"],
            self.user.username,
        )

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
            [item["id"] for item in response.data["results"]],
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
            [item["id"] for item in response.data["results"]],
            [newer_run.pk, older_run.pk],
        )

    def test_results_are_paginated_twenty_per_page(self):
        runs = [
            self._create_run(self.project, f"run-{index:02}.json")
            for index in range(21)
        ]
        shared_time = timezone.now()
        ReportRun.objects.filter(pk__in=[run.pk for run in runs]).update(
            created_at=shared_time
        )
        self.client.force_authenticate(self.user)

        first_page = self.client.get(self.url)
        second_page = self.client.get(self.url, {"page": 2})

        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data["count"], 21)
        self.assertEqual(len(first_page.data["results"]), 20)
        self.assertIsNotNone(first_page.data["next"])
        self.assertIsNone(first_page.data["previous"])
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_page.data["results"]), 1)
        self.assertIsNone(second_page.data["next"])
        self.assertIsNotNone(second_page.data["previous"])
        self.assertEqual(
            [item["id"] for item in first_page.data["results"]],
            [run.pk for run in reversed(runs[1:])],
        )
        self.assertEqual(second_page.data["results"][0]["id"], runs[0].pk)

    def test_framework_filter(self):
        cucumber = self._create_run(self.project, "cucumber.json")
        self._create_run(
            self.project,
            "playwright.json",
            framework=ReportRun.Framework.PLAYWRIGHT,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            self.url,
            {"framework": ReportRun.Framework.CUCUMBER},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [cucumber.pk],
        )

    def test_processing_status_filter(self):
        failed = self._create_run(
            self.project,
            "failed.json",
            status=ReportRun.Status.FAILED,
        )
        self._create_run(self.project, "completed.json")
        self.client.force_authenticate(self.user)

        response = self.client.get(
            self.url,
            {"status": ReportRun.Status.FAILED},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["id"], failed.pk)
        self.assertEqual(response.data["count"], 1)

    def test_uploaded_date_from_filter_is_inclusive(self):
        old_run = self._create_run(self.project, "old.json")
        boundary_run = self._create_run(self.project, "boundary.json")
        ReportRun.objects.filter(pk=old_run.pk).update(
            created_at=datetime(2026, 7, 9, 23, 59, tzinfo=datetime_timezone.utc)
        )
        ReportRun.objects.filter(pk=boundary_run.pk).update(
            created_at=datetime(2026, 7, 10, 0, 0, tzinfo=datetime_timezone.utc)
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            self.url,
            {"uploaded_date_from": "2026-07-10"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [boundary_run.pk],
        )

    def test_uploaded_date_to_filter_is_inclusive(self):
        boundary_run = self._create_run(self.project, "boundary.json")
        newer_run = self._create_run(self.project, "newer.json")
        ReportRun.objects.filter(pk=boundary_run.pk).update(
            created_at=datetime(2026, 7, 10, 23, 59, tzinfo=datetime_timezone.utc)
        )
        ReportRun.objects.filter(pk=newer_run.pk).update(
            created_at=datetime(2026, 7, 11, 0, 0, tzinfo=datetime_timezone.utc)
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            self.url,
            {"uploaded_date_to": "2026-07-10"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [boundary_run.pk],
        )

    def test_original_filename_search_is_case_insensitive(self):
        matching = self._create_run(self.project, "Nightly-Checkout.JSON")
        self._create_run(self.project, "smoke-login.json")
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url, {"filename": "checkout"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [matching.pk],
        )

    def test_filters_can_be_combined(self):
        matching = self._create_run(
            self.project,
            "nightly-checkout.json",
            framework=ReportRun.Framework.PLAYWRIGHT,
            status=ReportRun.Status.FAILED,
        )
        wrong_status = self._create_run(
            self.project,
            "nightly-other.json",
            framework=ReportRun.Framework.PLAYWRIGHT,
        )
        ReportRun.objects.filter(pk__in=[matching.pk, wrong_status.pk]).update(
            created_at=datetime(2026, 7, 15, 12, 0, tzinfo=datetime_timezone.utc)
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(self.url, {
            "framework": "PLAYWRIGHT",
            "status": "FAILED",
            "uploaded_date_from": "2026-07-15",
            "uploaded_date_to": "2026-07-15",
            "filename": "nightly",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], matching.pk)

    def test_invalid_filter_values_return_400(self):
        self.client.force_authenticate(self.user)
        invalid_filters = [
            ({"framework": "INVALID"}, "framework"),
            ({"status": "INVALID"}, "status"),
            ({"uploaded_date_from": "07/15/2026"}, "uploaded_date_from"),
            ({"uploaded_date_to": "not-a-date"}, "uploaded_date_to"),
            ({
                "uploaded_date_from": "2026-07-16",
                "uploaded_date_to": "2026-07-15",
            }, "uploaded_date_to"),
            ({"filename": ""}, "filename"),
        ]

        for query, error_field in invalid_filters:
            with self.subTest(query=query):
                response = self.client.get(self.url, query)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(error_field, response.data)
