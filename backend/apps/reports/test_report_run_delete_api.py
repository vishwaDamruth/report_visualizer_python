import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project

from .models import ReportRun, TestExecution


class ReportRunDeleteApiTests(APITestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.media_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)

        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="delete-owner")
        self.other_user = user_model.objects.create_user(username="other-delete-owner")
        self.project = Project.objects.create(name="Delete Project", owner=self.user)
        self.other_project = Project.objects.create(
            name="Private Delete Project",
            owner=self.other_user,
        )
        self.report_run = self._create_run(self.project, "delete-me.json")
        self.url = reverse("reports:report-run-detail", args=[self.report_run.pk])

    def _create_run(self, project, filename):
        report_run = ReportRun(
            project=project,
            uploaded_by=project.owner,
            framework=ReportRun.Framework.CUCUMBER,
            original_filename=filename,
            status=ReportRun.Status.COMPLETED,
            total_tests=1,
            passed_tests=1,
            total_duration=1.0,
        )
        report_run.raw_file.save(filename, ContentFile(b'{"report": true}'), save=False)
        report_run.save()
        return report_run

    def test_authenticated_owner_can_delete_report(self):
        self.client.force_authenticate(self.user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ReportRun.objects.filter(pk=self.report_run.pk).exists())

    def test_unauthenticated_request_returns_401(self):
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(ReportRun.objects.filter(pk=self.report_run.pk).exists())

    def test_another_users_report_returns_404(self):
        private_report = self._create_run(self.other_project, "private.json")
        self.client.force_authenticate(self.user)

        response = self.client.delete(
            reverse("reports:report-run-detail", args=[private_report.pk])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ReportRun.objects.filter(pk=private_report.pk).exists())

    def test_nonexistent_report_returns_404(self):
        self.client.force_authenticate(self.user)

        response = self.client.delete(
            reverse("reports:report-run-detail", args=[999999])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_related_test_executions_are_removed(self):
        execution = TestExecution.objects.create(
            report_run=self.report_run,
            scenario="deleted with parent",
            status=TestExecution.Status.PASSED,
        )
        self.client.force_authenticate(self.user)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TestExecution.objects.filter(pk=execution.pk).exists())

    def test_stored_raw_file_is_removed_after_commit(self):
        raw_file_path = Path(self.report_run.raw_file.path)
        self.assertTrue(raw_file_path.exists())
        self.client.force_authenticate(self.user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(raw_file_path.exists())

    def test_deleting_one_run_does_not_affect_other_runs(self):
        retained_run = self._create_run(self.project, "keep-me.json")
        retained_execution = TestExecution.objects.create(
            report_run=retained_run,
            scenario="must remain",
            status=TestExecution.Status.FAILED,
        )
        retained_file_path = Path(retained_run.raw_file.path)
        self.client.force_authenticate(self.user)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(ReportRun.objects.filter(pk=retained_run.pk).exists())
        self.assertTrue(TestExecution.objects.filter(pk=retained_execution.pk).exists())
        self.assertTrue(retained_file_path.exists())
