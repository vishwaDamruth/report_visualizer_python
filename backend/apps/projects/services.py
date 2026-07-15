from .models import Project


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