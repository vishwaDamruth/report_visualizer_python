from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project

from .models import ReportRun, TestExecution


class ProjectDashboardApiTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="dashboard-owner")
        self.other_user = user_model.objects.create_user(username="other-dashboard-owner")
        self.project = Project.objects.create(name="Dashboard Project", created_by=self.user)
        self.other_project = Project.objects.create(name="Private Project", created_by=self.other_user)
        self.url = reverse("reports:project-dashboard", args=[self.project.pk])

    def _run(self, filename, project=None, **overrides):
        project = project or self.project
        values = {
            "project": project,
            "uploaded_by": project.created_by,
            "framework": ReportRun.Framework.CUCUMBER,
            "raw_file": f"reports/{filename}",
            "original_filename": filename,
            "status": ReportRun.Status.COMPLETED,
            "total_tests": 10,
            "passed_tests": 7,
            "failed_tests": 2,
            "skipped_tests": 1,
            "total_duration": 10.0,
        }
        values.update(overrides)
        return ReportRun.objects.create(**values)

    def _execution(self, run, scenario, **overrides):
        values = {
            "report_run": run,
            "feature": "Checkout",
            "suite": "",
            "scenario": scenario,
            "status": TestExecution.Status.PASSED,
            "duration": 1.0,
            "error_message": "",
            "file_path": "features/checkout.feature",
            "line_number": 10,
            "retry_count": 0,
        }
        values.update(overrides)
        return TestExecution.objects.create(**values)

    def test_unauthenticated_request_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_another_users_project_returns_404(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(
            reverse("reports:project-dashboard", args=[self.other_project.pk])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_empty_project_returns_stable_response(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {
            "project_id": self.project.pk,
            "scope": {
                "test_analytics_run_status": "COMPLETED",
                "trend_time_basis": "report_run.created_at",
                "duration_unit": "seconds",
            },
            "metrics": {
                "total_report_runs": 0, "completed_report_runs": 0,
                "pending_report_runs": 0, "processing_report_runs": 0,
                "failed_report_runs": 0, "total_tests_executed": 0,
                "passed_tests": 0, "failed_tests": 0, "skipped_tests": 0,
                "unknown_tests": 0, "overall_pass_rate": None,
                "average_run_duration": None,
            },
            "latest_run": None,
            "outcome_distribution": {"passed": 0, "failed": 0, "skipped": 0, "unknown": 0},
            "pass_rate_trend": [], "duration_trend": [],
            "recent_failed_executions": [], "slowest_executions": [],
        })

    def test_correct_totals_use_only_completed_runs_for_analytics(self):
        self._run("one.json", total_tests=8, passed_tests=5, failed_tests=2,
                  skipped_tests=0, total_duration=12.0)
        self._run("two.json", total_tests=4, passed_tests=3, failed_tests=0,
                  skipped_tests=1, total_duration=6.0)
        self._run("pending.json", status=ReportRun.Status.PENDING,
                  total_tests=100, passed_tests=100, failed_tests=0, skipped_tests=0)
        self._run("failed.json", status=ReportRun.Status.FAILED,
                  total_tests=200, passed_tests=0, failed_tests=200, skipped_tests=0)
        self.client.force_authenticate(self.user)
        metrics = self.client.get(self.url).data["metrics"]
        self.assertEqual(metrics, {
            "total_report_runs": 4, "completed_report_runs": 2,
            "pending_report_runs": 1, "processing_report_runs": 0,
            "failed_report_runs": 1, "total_tests_executed": 12,
            "passed_tests": 8, "failed_tests": 2, "skipped_tests": 1,
            "unknown_tests": 1, "overall_pass_rate": 66.67,
            "average_run_duration": 9.0,
        })

    def test_pass_rate_is_test_weighted_half_up_and_handles_zero(self):
        self._run("weighted.json", total_tests=6, passed_tests=1,
                  failed_tests=5, skipped_tests=0)
        self._run("zero.json", total_tests=0, passed_tests=0,
                  failed_tests=0, skipped_tests=0)
        self.client.force_authenticate(self.user)
        data = self.client.get(self.url).data
        self.assertEqual(data["metrics"]["overall_pass_rate"], 16.67)
        self.assertEqual(data["pass_rate_trend"][1]["pass_rate"], None)

    def test_latest_run_uses_all_runs_and_reports_processing_state(self):
        older = self._run("completed.json")
        latest = self._run("processing.json", status=ReportRun.Status.PROCESSING,
                           error_message="still processing")
        now = timezone.now()
        ReportRun.objects.filter(pk=older.pk).update(created_at=now - timedelta(hours=1))
        ReportRun.objects.filter(pk=latest.pk).update(created_at=now)
        self.client.force_authenticate(self.user)
        latest_data = self.client.get(self.url).data["latest_run"]
        self.assertEqual(latest_data["id"], latest.pk)
        self.assertEqual(latest_data["status"], "PROCESSING")
        self.assertIsNone(latest_data["pass_rate"])
        self.assertEqual(latest_data["error_message"], "still processing")

    def test_trends_are_oldest_first_with_id_as_tie_breaker(self):
        first = self._run("first.json", total_tests=4, passed_tests=3,
                          failed_tests=1, skipped_tests=0, total_duration=4.0)
        second = self._run("second.json", total_tests=5, passed_tests=2,
                           failed_tests=2, skipped_tests=1, total_duration=5.0)
        ignored = self._run("ignored.json", status=ReportRun.Status.FAILED)
        same_time = timezone.now() - timedelta(days=1)
        ReportRun.objects.filter(pk__in=[first.pk, second.pk, ignored.pk]).update(created_at=same_time)
        self.client.force_authenticate(self.user)
        data = self.client.get(self.url).data
        self.assertEqual([x["report_run_id"] for x in data["pass_rate_trend"]], [first.pk, second.pk])
        self.assertEqual([x["report_run_id"] for x in data["duration_trend"]], [first.pk, second.pk])
        self.assertEqual([x["pass_rate"] for x in data["pass_rate_trend"]], [75.0, 40.0])

    def test_recent_failures_are_newest_first_limited_and_completed_only(self):
        old_run = self._run("old.json")
        new_run = self._run("new.json")
        incomplete = self._run("incomplete.json", status=ReportRun.Status.FAILED)
        now = timezone.now()
        ReportRun.objects.filter(pk=old_run.pk).update(created_at=now - timedelta(days=1))
        ReportRun.objects.filter(pk=new_run.pk).update(created_at=now)
        old_failure = self._execution(old_run, "old failure", status=TestExecution.Status.FAILED)
        newest_failures = [
            self._execution(new_run, f"new failure {index}", status=TestExecution.Status.FAILED)
            for index in range(5)
        ]
        self._execution(incomplete, "excluded", status=TestExecution.Status.FAILED)
        self.client.force_authenticate(self.user)
        items = self.client.get(self.url).data["recent_failed_executions"]
        self.assertEqual([item["id"] for item in items], [x.pk for x in reversed(newest_failures)])
        self.assertNotIn(old_failure.pk, [item["id"] for item in items])

    def test_slowest_executions_are_ordered_limited_and_completed_only(self):
        old_run = self._run("old.json")
        new_run = self._run("new.json")
        incomplete = self._run("failed.json", status=ReportRun.Status.FAILED)
        now = timezone.now()
        ReportRun.objects.filter(pk=old_run.pk).update(created_at=now - timedelta(days=1))
        ReportRun.objects.filter(pk=new_run.pk).update(created_at=now)
        executions = [
            self._execution(old_run, f"duration {duration}", duration=duration)
            for duration in [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        ]
        tied_newer = self._execution(new_run, "new duration 5", duration=5.0)
        self._execution(incomplete, "excluded duration", duration=100.0)
        self.client.force_authenticate(self.user)
        items = self.client.get(self.url).data["slowest_executions"]
        self.assertEqual(
            [item["id"] for item in items],
            [executions[5].pk, tied_newer.pk, executions[4].pk, executions[3].pk, executions[2].pk],
        )
