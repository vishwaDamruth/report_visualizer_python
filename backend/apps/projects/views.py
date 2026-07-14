from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Project
from .serializers import ProjectSerializer



class ProjectListCreateView(
    generics.ListCreateAPIView
):

    permission_classes = [
        IsAuthenticated
    ]


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