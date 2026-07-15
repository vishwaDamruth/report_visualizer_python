from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project

from .models import ReportRun
from .serializers import ReportRunDetailSerializer, ReportRunListSerializer
from .services import ReportIngestionError, ReportIngestionService


class ReportUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, project_id):
        project = get_object_or_404(
            Project,
            pk=project_id,
            created_by=request.user,
        )

        try:
            report_run = ReportIngestionService.ingest(
                project=project,
                user=request.user,
                uploaded_file=request.FILES.get("file"),
            )
        except ReportIngestionError as error:
            return Response(
                {"error": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReportRunDetailSerializer(
            report_run,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProjectReportRunListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportRunListSerializer

    def get_queryset(self):
        project = get_object_or_404(
            Project,
            pk=self.kwargs["project_id"],
            created_by=self.request.user,
        )
        return (
            ReportRun.objects.filter(project=project)
            .select_related("project", "uploaded_by")
            .order_by("-created_at")
        )


class ReportRunDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReportRunDetailSerializer
    lookup_url_kwarg = "report_run_id"

    def get_queryset(self):
        return (
            ReportRun.objects.filter(project__created_by=self.request.user)
            .select_related("project", "uploaded_by")
            .prefetch_related("executions")
        )
