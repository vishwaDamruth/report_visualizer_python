from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project, ProjectMembership
from .serializers import ProjectSerializer

from .services import ProjectService
from .services import ProjectAccessService



class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer

    def get_queryset(self):
        return ProjectAccessService.get_accessible_projects(
            self.request.user
        )

    def perform_create(self, serializer):
        ProjectService.create_project(
            user=self.request.user,
            validated_data=serializer.validated_data,
        )


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):

    # GET is allowed for both OWNER and VIEWER
    project = ProjectAccessService.get_project_for_user(
        request.user,
        pk,
    )

    if request.method == "GET":
        serializer = ProjectSerializer(
            project,
            context={"request": request},
        )
        return Response(serializer.data)

    if request.method == "PUT":
        # Only OWNER can modify
        project = ProjectAccessService.get_owned_project(
            request.user,
            pk,
        )

        project = ProjectService.update_project(
            project,
            request.data,
        )

        serializer = ProjectSerializer(
            project,
            context={"request": request},
        )
        return Response(serializer.data)

    if request.method == "DELETE":
        # Only OWNER can delete
        project = ProjectAccessService.get_owned_project(
            request.user,
            pk,
        )

        ProjectService.delete_project(project)
        return Response(status=status.HTTP_204_NO_CONTENT)