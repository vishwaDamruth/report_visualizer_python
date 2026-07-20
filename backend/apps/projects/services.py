from .models import Project, ProjectMembership
from django.db import transaction
from django.shortcuts import get_object_or_404


class ProjectService:

    @staticmethod
    def update_project(project, data):
        """
        Updates a project's editable fields.
        """

        project.name = data.get("name", project.name)
        project.description = data.get(
            "description",
            project.description
        )

        project.save()

        return project


    @staticmethod
    def delete_project(project):
        project.delete()


class ProjectAccessService:
    @staticmethod
    def get_accessible_projects(user):
        return Project.objects.filter(
            memberships__user=user
        ).distinct()

    @staticmethod
    def get_project_for_user(user, project_id: int) -> Project:
        return get_object_or_404(
            Project.objects.distinct(),
            id=project_id,
            memberships__user=user,
        )

    @staticmethod
    def get_owned_project(user, project_id: int) -> Project:
        return get_object_or_404(
            Project.objects.distinct(),
            id=project_id,
            memberships__user=user,
            memberships__role=ProjectMembership.Role.OWNER,
        )

    @staticmethod
    def can_modify_project(user, project: Project) -> bool:
        return ProjectMembership.objects.filter(
            project=project,
            user=user,
            role=ProjectMembership.Role.OWNER,
        ).exists()


    @staticmethod
    @transaction.atomic
    def create_project(*, user, validated_data):

        project = Project.objects.create(
            owner=user,
            **validated_data,
        )

        ProjectMembership.objects.create(
            project=project,
            user=user,
            role=ProjectMembership.Role.OWNER,
        )

        return project