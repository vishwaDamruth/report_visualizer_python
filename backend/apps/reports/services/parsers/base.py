from dataclasses import dataclass, field
from datetime import datetime


class ReportParserError(ValueError):
    """Raised when report content does not match a supported parser contract."""


@dataclass(frozen=True)
class ParsedTestExecution:
    external_id: str | None
    feature: str
    suite: str
    scenario: str
    status: str
    duration: float
    error_message: str = ""
    tags: list[str] = field(default_factory=list)
    file_path: str = ""
    line_number: int | None = None
    retry_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None


@dataclass(frozen=True)
class ParsedReport:
    framework: str
    executions: list[ParsedTestExecution]
    duration_unit: str = "seconds"
