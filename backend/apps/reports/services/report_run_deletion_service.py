from django.db import transaction

from ..models import ReportRun


class ReportRunDeletionService:
    @staticmethod
    def delete(report_run: ReportRun) -> None:
        raw_file_name = report_run.raw_file.name
        raw_file_storage = report_run.raw_file.storage

        with transaction.atomic():
            report_run.delete()

            if raw_file_name:
                transaction.on_commit(
                    lambda: raw_file_storage.delete(raw_file_name)
                )
