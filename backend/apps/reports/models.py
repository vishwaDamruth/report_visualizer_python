import uuid
from pathlib import Path

from django.conf import settings
from django.db import models

from apps.projects.models import Project


def report_upload_path(instance, filename):
    """Keep uploads project-scoped and collision-safe without trusting client names."""
    safe_filename = Path(filename).name
    return f"reports/project_{instance.project_id}/{uuid.uuid4()}_{safe_filename}"


class ReportRun(models.Model):
    class Framework(models.TextChoices):
        PLAYWRIGHT = "PLAYWRIGHT", "Playwright"
        CUCUMBER = "CUCUMBER", "Cucumber"
        UNKNOWN = "UNKNOWN", "Unknown"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="report_runs")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_report_runs",
    )
    framework = models.CharField(max_length=20, choices=Framework.choices, default=Framework.UNKNOWN)
    raw_file = models.FileField(upload_to=report_upload_path)
    original_filename = models.CharField(max_length=255)
    file_hash = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_tests = models.PositiveIntegerField(default=0)
    passed_tests = models.PositiveIntegerField(default=0)
    failed_tests = models.PositiveIntegerField(default=0)
    skipped_tests = models.PositiveIntegerField(default=0)
    total_duration = models.FloatField(default=0.0)
    parser_version = models.CharField(max_length=50, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.project.name} - {self.original_filename}"


class TestExecution(models.Model):
    class Status(models.TextChoices):
        PASSED = "PASSED", "Passed"
        FAILED = "FAILED", "Failed"
        SKIPPED = "SKIPPED", "Skipped"
        UNKNOWN = "UNKNOWN", "Unknown"

    report_run = models.ForeignKey(ReportRun, on_delete=models.CASCADE, related_name="executions")
    external_id = models.CharField(max_length=255, blank=True, null=True)
    feature = models.CharField(max_length=255, blank=True)
    suite = models.CharField(max_length=255, blank=True)
    scenario = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNKNOWN)
    duration = models.FloatField(default=0.0)
    error_message = models.TextField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    file_path = models.CharField(max_length=1000, blank=True)
    line_number = models.PositiveIntegerField(blank=True, null=True)
    retry_count = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["report_run", "status"]),
            models.Index(fields=["scenario"]),
        ]

    def __str__(self):
        return f"{self.scenario} ({self.status})"
