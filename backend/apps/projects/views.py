from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Project
from .serializers import ProjectSerializer

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .services import ProjectService







class ProjectListCreateView(generics.ListCreateAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer



    def get_queryset(self):

        # Only show projects created by logged in user
        return Project.objects.filter(
            created_by=self.request.user
        )



    def perform_create(self, serializer):

        # Automatically attach logged in user
        serializer.save(
            created_by=self.request.user
        )



@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):

    try:
        project = Project.objects.get(
            pk=pk,
            created_by=request.user
        )
    except Project.DoesNotExist:
        return Response(
            {"error": "Project not found"},
            status=404
        )

    if request.method == "GET":
        serializer = ProjectSerializer(project)
        return Response(serializer.data)

    if request.method == "PUT":
        project = ProjectService.update_project(
            project,
            request.data
        )

        serializer = ProjectSerializer(project)
        return Response(serializer.data)

    if request.method == "DELETE":
        project.delete()
        return Response(status=204)
