import logging
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Avg, Count, Q, Sum

from ..models import ReportRun, TestExecution


logger = logging.getLogger(__name__)


def _pass_rate(passed, total):
    if total == 0:
        return None
    return float(
        (Decimal(passed) * Decimal("100") / Decimal(total)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    )


def _unknown(total, passed, failed, skipped, context):
    value = total - passed - failed - skipped
    if value < 0:
        logger.warning("Negative derived unknown test count for %s; clamping to zero", context)
        return 0
    return value


def _execution_item(execution):
    run = execution.report_run
    return {
        "id": execution.id,
        "report_run_id": run.id,
        "report_run_created_at": run.created_at,
        "report_filename": run.original_filename,
        "feature": execution.feature,
        "suite": execution.suite,
        "scenario": execution.scenario,
        "status": execution.status,
        "duration": execution.duration,
        "error_message": execution.error_message,
        "file_path": execution.file_path,
        "line_number": execution.line_number,
        "retry_count": execution.retry_count,
    }


class ProjectDashboardService:
    @classmethod
    def build(cls, project):
        all_runs = ReportRun.objects.filter(project=project)
        completed_runs = all_runs.filter(status=ReportRun.Status.COMPLETED)

        run_counts = all_runs.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(status=ReportRun.Status.COMPLETED)),
            pending=Count("id", filter=Q(status=ReportRun.Status.PENDING)),
            processing=Count("id", filter=Q(status=ReportRun.Status.PROCESSING)),
            failed=Count("id", filter=Q(status=ReportRun.Status.FAILED)),
        )
        totals = completed_runs.aggregate(
            total_tests=Sum("total_tests"),
            passed=Sum("passed_tests"),
            failed=Sum("failed_tests"),
            skipped=Sum("skipped_tests"),
            average_duration=Avg("total_duration"),
        )
        total_tests = totals["total_tests"] or 0
        passed = totals["passed"] or 0
        failed = totals["failed"] or 0
        skipped = totals["skipped"] or 0
        unknown = _unknown(total_tests, passed, failed, skipped, f"project {project.pk}")

        latest = all_runs.select_related("uploaded_by").order_by("-created_at", "-id").first()
        latest_run = None
        if latest is not None:
            latest_unknown = _unknown(
                latest.total_tests,
                latest.passed_tests,
                latest.failed_tests,
                latest.skipped_tests,
                f"report run {latest.pk}",
            )
            latest_run = {
                "id": latest.id,
                "framework": latest.framework,
                "status": latest.status,
                "original_filename": latest.original_filename,
                "total_tests": latest.total_tests,
                "passed_tests": latest.passed_tests,
                "failed_tests": latest.failed_tests,
                "skipped_tests": latest.skipped_tests,
                "unknown_tests": latest_unknown,
                "pass_rate": (
                    _pass_rate(latest.passed_tests, latest.total_tests)
                    if latest.status == ReportRun.Status.COMPLETED
                    else None
                ),
                "total_duration": latest.total_duration,
                "uploaded_by": latest.uploaded_by.username,
                "created_at": latest.created_at,
                "error_message": latest.error_message,
            }

        pass_rate_trend = []
        duration_trend = []
        trend_runs = completed_runs.order_by("created_at", "id").values(
            "id", "original_filename", "created_at", "total_tests",
            "passed_tests", "total_duration",
        )
        for run in trend_runs:
            pass_rate_trend.append({
                "report_run_id": run["id"],
                "original_filename": run["original_filename"],
                "created_at": run["created_at"],
                "total_tests": run["total_tests"],
                "passed_tests": run["passed_tests"],
                "pass_rate": _pass_rate(run["passed_tests"], run["total_tests"]),
            })
            duration_trend.append({
                "report_run_id": run["id"],
                "original_filename": run["original_filename"],
                "created_at": run["created_at"],
                "total_duration": run["total_duration"],
            })

        executions = TestExecution.objects.filter(
            report_run__project=project,
            report_run__status=ReportRun.Status.COMPLETED,
        ).select_related("report_run")
        recent_failures = executions.filter(status=TestExecution.Status.FAILED).order_by(
            "-report_run__created_at", "-report_run__id", "-id"
        )[:5]
        slowest = executions.order_by(
            "-duration", "-report_run__created_at", "-report_run__id", "-id"
        )[:5]

        return {
            "project_id": project.pk,
            "scope": {
                "test_analytics_run_status": ReportRun.Status.COMPLETED,
                "trend_time_basis": "report_run.created_at",
                "duration_unit": "seconds",
            },
            "metrics": {
                "total_report_runs": run_counts["total"],
                "completed_report_runs": run_counts["completed"],
                "pending_report_runs": run_counts["pending"],
                "processing_report_runs": run_counts["processing"],
                "failed_report_runs": run_counts["failed"],
                "total_tests_executed": total_tests,
                "passed_tests": passed,
                "failed_tests": failed,
                "skipped_tests": skipped,
                "unknown_tests": unknown,
                "overall_pass_rate": _pass_rate(passed, total_tests),
                "average_run_duration": totals["average_duration"],
            },
            "latest_run": latest_run,
            "outcome_distribution": {
                "passed": passed, "failed": failed, "skipped": skipped, "unknown": unknown,
            },
            "pass_rate_trend": pass_rate_trend,
            "duration_trend": duration_trend,
            "recent_failed_executions": [_execution_item(item) for item in recent_failures],
            "slowest_executions": [_execution_item(item) for item in slowest],
        }
