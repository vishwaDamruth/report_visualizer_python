import hashlib
import json
import re
from pathlib import Path

from django.conf import settings
from django.db import transaction

from apps.reports.models import ReportRun, TestExecution

from .parsers import CucumberJsonParser, ReportParserError


class ReportIngestionError(ValueError):
    """A safe ingestion failure that callers may return at the HTTP boundary later."""

    def __init__(self, message, report_run=None):
        super().__init__(message)
        self.report_run = report_run


class ReportIngestionService:
    DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024
    PARSER_VERSION = "cucumber-json-v1"
    ERROR_MESSAGE_LIMIT = 2000
    ANSI_ESCAPE_PATTERN = re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|[@-_])")

    @classmethod
    def ingest(cls, project, user, uploaded_file, parser=None):
        cls._validate_file(uploaded_file)
        original_filename = Path(uploaded_file.name).name
        file_hash = cls._calculate_hash(uploaded_file)

        report_run = ReportRun.objects.create(
            project=project,
            uploaded_by=user,
            framework=ReportRun.Framework.CUCUMBER,
            raw_file=uploaded_file,
            original_filename=original_filename,
            file_hash=file_hash,
            status=ReportRun.Status.PROCESSING,
            parser_version=cls.PARSER_VERSION,
        )

        try:
            payload = cls._read_json(report_run)
            parsed_report = (parser or CucumberJsonParser()).parse(payload)
            cls._persist_parsed_report(report_run, parsed_report)
        except Exception as error:
            safe_message = cls._safe_error_message(error)
            report_run.status = ReportRun.Status.FAILED
            report_run.error_message = safe_message
            report_run.save(update_fields=["status", "error_message", "updated_at"])
            raise ReportIngestionError(safe_message, report_run=report_run) from error

        return report_run

    @classmethod
    def _validate_file(cls, uploaded_file):
        if uploaded_file is None:
            raise ReportIngestionError("A report file is required.")

        filename = getattr(uploaded_file, "name", "")
        if not filename or Path(filename).suffix.lower() != ".json":
            raise ReportIngestionError("Only JSON report files are supported.")

        size = getattr(uploaded_file, "size", None)
        if not isinstance(size, int) or size <= 0:
            raise ReportIngestionError("The report file is empty.")

        max_size = getattr(settings, "REPORT_UPLOAD_MAX_SIZE", cls.DEFAULT_MAX_FILE_SIZE)
        if size > max_size:
            raise ReportIngestionError(
                f"The report file exceeds the {max_size // (1024 * 1024)} MB size limit."
            )

    @staticmethod
    def _calculate_hash(uploaded_file):
        digest = hashlib.sha256()
        for chunk in uploaded_file.chunks():
            digest.update(chunk)
        uploaded_file.seek(0)
        return digest.hexdigest()

    @staticmethod
    def _read_json(report_run):
        try:
            with report_run.raw_file.open("rb") as raw_file:
                return json.loads(raw_file.read().decode("utf-8"))
        except UnicodeDecodeError as error:
            raise ReportParserError("The uploaded report must use UTF-8 encoding.") from error
        except json.JSONDecodeError as error:
            raise ReportParserError("The uploaded file is not valid JSON.") from error

    @classmethod
    def _persist_parsed_report(cls, report_run, parsed_report):
        if parsed_report.duration_unit != "seconds":
            raise ReportParserError("The parser returned an unsupported duration unit.")

        executions = [
            TestExecution(
                report_run=report_run,
                external_id=execution.external_id,
                feature=execution.feature,
                suite=execution.suite,
                scenario=execution.scenario,
                status=execution.status,
                duration=execution.duration,
                error_message=execution.error_message,
                tags=execution.tags,
                file_path=execution.file_path,
                line_number=execution.line_number,
                retry_count=execution.retry_count,
                started_at=execution.started_at,
                finished_at=execution.finished_at,
            )
            for execution in parsed_report.executions
        ]

        with transaction.atomic():
            TestExecution.objects.bulk_create(executions)
            report_run.framework = parsed_report.framework
            report_run.total_tests = len(executions)
            report_run.passed_tests = sum(
                execution.status == TestExecution.Status.PASSED for execution in executions
            )
            report_run.failed_tests = sum(
                execution.status == TestExecution.Status.FAILED for execution in executions
            )
            report_run.skipped_tests = sum(
                execution.status == TestExecution.Status.SKIPPED for execution in executions
            )
            report_run.total_duration = sum(execution.duration for execution in executions)
            report_run.status = ReportRun.Status.COMPLETED
            report_run.error_message = ""
            report_run.save(
                update_fields=[
                    "framework",
                    "total_tests",
                    "passed_tests",
                    "failed_tests",
                    "skipped_tests",
                    "total_duration",
                    "status",
                    "error_message",
                    "updated_at",
                ]
            )

    @classmethod
    def _safe_error_message(cls, error):
        if isinstance(error, ReportParserError):
            message = str(error)
        else:
            message = "The report could not be processed."

        message = cls.ANSI_ESCAPE_PATTERN.sub("", message)
        message = " ".join(message.splitlines())
        message = "".join(character for character in message if character.isprintable())
        return message[: cls.ERROR_MESSAGE_LIMIT] or "The report could not be processed."
