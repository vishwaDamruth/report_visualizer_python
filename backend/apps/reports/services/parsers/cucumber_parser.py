from datetime import datetime
from typing import Any

from .base import ParsedReport, ParsedTestExecution, ReportParserError


class CucumberJsonParser:
    """Parse the legacy Cucumber JSON feature/elements/steps format."""

    FRAMEWORK = "CUCUMBER"
    NANOSECONDS_PER_SECOND = 1_000_000_000
    FAILED_STATUSES = {"failed", "ambiguous"}
    SKIPPED_STATUSES = {"skipped", "pending", "undefined"}

    def parse(self, data: Any) -> ParsedReport:
        if not isinstance(data, list) or not data:
            raise ReportParserError("Cucumber report must be a non-empty feature array.")

        executions: list[ParsedTestExecution] = []
        for feature in data:
            if not isinstance(feature, dict):
                raise ReportParserError("Each Cucumber feature must be an object.")

            elements = feature.get("elements")
            if not isinstance(elements, list):
                raise ReportParserError("Each Cucumber feature must contain an elements array.")

            for scenario in elements:
                executions.append(self._parse_scenario(feature, scenario))

        if not executions:
            raise ReportParserError("Cucumber report does not contain any scenarios.")

        return ParsedReport(framework=self.FRAMEWORK, executions=executions)

    def _parse_scenario(
        self,
        feature: dict[str, Any],
        scenario: Any,
    ) -> ParsedTestExecution:
        if not isinstance(scenario, dict):
            raise ReportParserError("Each Cucumber scenario must be an object.")

        scenario_name = scenario.get("name")
        steps = scenario.get("steps")
        if not isinstance(scenario_name, str) or not scenario_name.strip():
            raise ReportParserError("Each Cucumber scenario must have a name.")
        if not isinstance(steps, list) or not steps:
            raise ReportParserError(f'Cucumber scenario "{scenario_name}" has no steps.')

        statuses: list[str] = []
        duration_nanoseconds = 0
        errors: list[str] = []

        for step in steps:
            if not isinstance(step, dict) or not isinstance(step.get("result"), dict):
                raise ReportParserError(
                    f'Cucumber scenario "{scenario_name}" has a step without a result.'
                )

            result = step["result"]
            status = str(result.get("status", "")).strip().lower()
            if status:
                statuses.append(status)

            duration = result.get("duration", 0)
            if not isinstance(duration, (int, float)) or isinstance(duration, bool) or duration < 0:
                raise ReportParserError(
                    f'Cucumber scenario "{scenario_name}" has an invalid step duration.'
                )
            duration_nanoseconds += duration

            error_message = result.get("error_message")
            if isinstance(error_message, str) and error_message:
                step_name = step.get("name") or step.get("keyword") or "Step"
                errors.append(f"{str(step_name).strip()}: {error_message}")

        feature_tags = self._normalize_tags(feature.get("tags"))
        scenario_tags = self._normalize_tags(scenario.get("tags"))

        return ParsedTestExecution(
            external_id=self._optional_string(scenario.get("id")),
            feature=self._optional_string(feature.get("name")) or "",
            suite="",
            scenario=scenario_name.strip(),
            status=self._normalize_scenario_status(statuses),
            duration=duration_nanoseconds / self.NANOSECONDS_PER_SECOND,
            error_message="\n\n".join(errors),
            tags=list(dict.fromkeys(feature_tags + scenario_tags)),
            file_path=self._optional_string(feature.get("uri")) or "",
            line_number=self._optional_non_negative_int(scenario.get("line")),
            retry_count=self._extract_retry_count(scenario),
            started_at=self._extract_timestamp(scenario, "started_at", "start_timestamp"),
            finished_at=self._extract_timestamp(scenario, "finished_at", "finish_timestamp"),
        )

    def _normalize_scenario_status(self, statuses: list[str]) -> str:
        if any(status in self.FAILED_STATUSES for status in statuses):
            return "FAILED"
        if any(status in self.SKIPPED_STATUSES for status in statuses):
            return "SKIPPED"
        if statuses and all(status == "passed" for status in statuses):
            return "PASSED"
        return "UNKNOWN"

    def _normalize_tags(self, tags: Any) -> list[str]:
        if not isinstance(tags, list):
            return []

        normalized: list[str] = []
        for tag in tags:
            value = tag.get("name") if isinstance(tag, dict) else tag
            if isinstance(value, str) and value.strip():
                normalized.append(value.strip())
        return normalized

    def _extract_retry_count(self, scenario: dict[str, Any]) -> int:
        for field_name in ("retry_count", "retry"):
            value = scenario.get(field_name)
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                return value
        return 0

    def _extract_timestamp(
        self,
        scenario: dict[str, Any],
        *field_names: str,
    ) -> datetime | None:
        for field_name in field_names:
            value = scenario.get(field_name)
            if not isinstance(value, str) or not value.strip():
                continue
            try:
                return datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            except ValueError as error:
                raise ReportParserError(
                    f'Cucumber scenario has an invalid "{field_name}" timestamp.'
                ) from error
        return None

    @staticmethod
    def _optional_string(value: Any) -> str | None:
        return value.strip() if isinstance(value, str) and value.strip() else None

    @staticmethod
    def _optional_non_negative_int(value: Any) -> int | None:
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            return value
        return None
