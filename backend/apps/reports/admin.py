from django.contrib import admin

from .models import ReportRun, TestExecution


@admin.register(ReportRun)
class ReportRunAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "framework", "status", "total_tests", "uploaded_by", "created_at")
    list_filter = ("framework", "status", "created_at")
    search_fields = ("project__name", "original_filename", "uploaded_by__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TestExecution)
class TestExecutionAdmin(admin.ModelAdmin):
    list_display = ("id", "scenario", "status", "duration", "report_run")
    list_filter = ("status",)
    search_fields = ("scenario", "feature", "suite", "external_id")
    readonly_fields = ("created_at",)
