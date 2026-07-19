from ..models import ReportRun


class ReportRunHistoryService:
    @staticmethod
    def get_queryset(project, filters):
        queryset = ReportRun.objects.filter(project=project)

        if "framework" in filters:
            queryset = queryset.filter(framework=filters["framework"])
        if "status" in filters:
            queryset = queryset.filter(status=filters["status"])
        if "uploaded_date_from" in filters:
            queryset = queryset.filter(
                created_at__date__gte=filters["uploaded_date_from"]
            )
        if "uploaded_date_to" in filters:
            queryset = queryset.filter(
                created_at__date__lte=filters["uploaded_date_to"]
            )
        if "filename" in filters:
            queryset = queryset.filter(
                original_filename__icontains=filters["filename"]
            )

        return (
            queryset
            .select_related("project", "uploaded_by")
            .order_by("-created_at", "-id")
        )
