from django.urls import path

from .views import (
    ProjectDashboardView,
    ProjectReportRunListView,
    ReportRunDetailView,
    ReportUploadView,
)

app_name = "reports"

urlpatterns = [
    path(
        "projects/<int:project_id>/dashboard/",
        ProjectDashboardView.as_view(),
        name="project-dashboard",
    ),
    path(
        "reports/<int:report_run_id>/",
        ReportRunDetailView.as_view(),
        name="report-run-detail",
    ),
    path(
        "projects/<int:project_id>/reports/",
        ProjectReportRunListView.as_view(),
        name="project-report-run-list",
    ),
    path(
        "projects/<int:project_id>/reports/upload/",
        ReportUploadView.as_view(),
        name="report-upload",
    ),
]
