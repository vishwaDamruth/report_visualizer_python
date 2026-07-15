# Cucumber Report JSON Schema Notes

## Scope

This review is based on `D:\PROJECTS\reports\Automation\test-results\cucumber-report.json` (18,542 bytes, inspected on 2026-07-15). The file uses the legacy Cucumber JSON formatter shape: a root array of feature objects containing scenario objects in `elements` and executable steps in `steps`.

Observed report summary:

- Features: 1
- Scenarios/test executions: 5
- Passed: 1
- Failed: 4
- Skipped: 0
- Derived total duration: 59,590,975,180 nanoseconds (59.59097518 seconds), including hooks

These notes distinguish fields observed in this fixture from fields that may exist in other Cucumber JSON reports.

## Root structure

```text
root: Feature[]
Feature
  description
  elements: Scenario[]
  id
  line
  keyword
  name
  tags
  uri
```

The root is an array, even when the report contains only one feature. An empty array must be treated as an unsupported/empty report rather than a successful run with zero tests.

## Feature, scenario, and step hierarchy

```text
root[]                                      feature
  .elements[]                              scenario/test execution
    .steps[]                               Gherkin steps and hidden hooks
      .result                              step outcome
      .match.location                      step-definition source location
```

There is no separate suite object in this fixture. The feature is the highest named grouping:

- Feature name: `root[i].name` (`Test Suite` in this fixture)
- Feature source: `root[i].uri` (`features\test.feature`)
- Scenario name: `root[i].elements[j].name`
- Scenario source line: `root[i].elements[j].line`
- Step name: `root[i].elements[j].steps[k].name` for normal steps

The two distinct scenario names are expanded into five executions. Expanded executions can share the same `id` and `name` while having different scenario `line` values. Therefore, scenario `id` alone is not unique within one report.

## Field paths and derivation rules

### Test name

The display path should be derived as:

```text
root[i].name + " > " + root[i].elements[j].name
```

Store the feature and scenario separately. Do not use a step name as the test name. For stable identification in this fixture, combine at least feature `uri`, scenario `id`, and scenario `line` because `id` is repeated across expanded examples.

### Status

There is no scenario-level result. Status exists at:

```text
root[i].elements[j].steps[k].result.status
```

Observed values are `passed` and `failed`. Normalize case to `PASSED`, `FAILED`, `SKIPPED`, or `UNKNOWN`.

Recommended scenario derivation:

1. `FAILED` if any step or hook is `failed`, `ambiguous`, or otherwise terminally unsuccessful.
2. `SKIPPED` if no step failed and at least one step is `skipped`, `pending`, or `undefined`.
3. `UNKNOWN` if there are no usable step results or an unrecognized status occurs.
4. `PASSED` only when all executable results are passed.

Hidden hook failures must affect the scenario result.

### Duration and unit

Duration exists per step/hook at:

```text
root[i].elements[j].steps[k].result.duration
```

The values are integer **nanoseconds**, consistent with the legacy Cucumber JSON formatter. Convert by dividing by `1,000,000,000` for seconds. The scenario duration is the sum of all step and hook durations; the run duration is the sum of scenario durations.

Derived fixture durations:

| Scenario line | Status | Nanoseconds | Seconds |
|---:|---|---:|---:|
| 14 | PASSED | 20,498,659,798 | 20.498659798 |
| 15 | FAILED | 10,652,421,796 | 10.652421796 |
| 28 | FAILED | 8,440,725,896 | 8.440725896 |
| 29 | FAILED | 9,911,489,794 | 9.911489794 |
| 30 | FAILED | 10,087,677,896 | 10.087677896 |

### Errors

Errors occur on individual failed results:

```text
root[i].elements[j].steps[k].result.error_message
```

The field is absent on passed steps. The observed value contains the assertion message, ANSI terminal escape sequences, a call log, and a stack trace. A parser should preserve the raw message in normalized storage but API/UI rendering should sanitize ANSI sequences. If multiple steps or hooks contain errors, concatenating them with step/hook context is safer than silently keeping only the first.

### Retries

No retry field or retry-attempt object exists in this fixture. Repeated scenario IDs are not sufficient evidence of retries: here they have different feature-file lines and represent expanded scenario examples.

`retry_count` can only default to zero for this format unless retry metadata is supplied elsewhere. It must not be inferred by counting repeated IDs.

### Tags

Tags can occur at both levels:

```text
root[i].tags
root[i].elements[j].tags
```

Both arrays are empty in this fixture, so the exact non-empty tag object shape is not demonstrated. Legacy Cucumber JSON commonly emits tag objects rather than plain strings. The parser should normalize feature and scenario tags into a deduplicated list of tag names and tolerate missing arrays.

### Timestamps

No execution start time, finish time, or report-generation timestamp exists anywhere in this fixture. Filesystem modification time is not a reliable execution timestamp. `ReportRun.created_at` can represent upload time, but it must not be described as test execution time.

### Source file and line

Scenario source:

```text
file: root[i].uri
line: root[i].elements[j].line
```

Feature declaration line is `root[i].line` and is `1` here. Normal steps also carry their Gherkin line at `steps[k].line`. Step implementation locations occur at:

```text
root[i].elements[j].steps[k].match.location
```

For example, `steps\stepdef.steps.ts:49` is the implementation location, not the scenario source. Hidden hooks in this fixture have neither a feature line nor a match location.

### Skipped tests

There are no skipped results in this fixture. Cucumber skip-like states may appear as `skipped`, `pending`, or `undefined`; these require normalization. A scenario should be counted once based on its derived scenario status, not once per skipped step.

### Hooks

Hooks are mixed into the scenario `steps` array. Observed hooks are:

```json
{
  "keyword": "Before",
  "hidden": true,
  "result": {"status": "passed", "duration": 7235413800}
}
```

Each scenario has one `Before` and one `After` hook. They have `hidden: true`, a `keyword`, and a `result`, but no `name`, `line`, `arguments`, or `match`. Hook status and duration should contribute to the enclosing scenario. The current normalized model cannot preserve hooks as separate records.

## Missing and optional source fields

Fields absent on some observed objects:

- `result.error_message`: only on failures
- Step `name`, `line`, `arguments`, and `match`: absent on hidden hooks
- `hidden`: present on hooks, absent on ordinary steps
- `description`: present but empty on feature/scenario objects
- `tags`: present but empty; non-empty representation is unverified

Fields absent from the entire fixture:

- Execution timestamps
- Retry attempt/count metadata
- Attachments, screenshots, or embeddings
- Browser/environment/build metadata
- Scenario-level status and duration
- A distinct suite layer
- Example-row parameter values as structured fields

A parser should treat optional fields defensively and must not turn an unrecognized or empty shape into a completed zero-test run.

## Mapping to existing models

### `ReportRun`

| Existing field | Source or derivation | Review |
|---|---|---|
| `project` | Upload request context | Correct; not present in JSON |
| `uploaded_by` | Authenticated request user | Correct; not present in JSON |
| `framework` | Detect legacy Cucumber root/features shape | Correct (`CUCUMBER`) |
| `raw_file` | Original uploaded file | Correct |
| `original_filename` | Multipart upload filename | Correct |
| `status` | Processing lifecycle, not test result | Correct |
| `total_tests` | Count all `elements[]` | Correct; expected 5 |
| `passed_tests` | Count derived `PASSED` scenarios | Correct; expected 1 |
| `failed_tests` | Count derived `FAILED` scenarios | Correct; expected 4 |
| `skipped_tests` | Count derived `SKIPPED` scenarios | Correct; expected 0 |
| `total_duration` | Sum every scenario step/hook duration after unit conversion | Semantically correct; type/unit needs definition |
| `parser_version` | Parser implementation metadata | Correct; not sourced from JSON |
| `error_message` | Report-level parser/processing error | Correct; do not put scenario failures here |
| `created_at` | Upload/database creation time | Correct only as upload time |
| `updated_at` | Processing/database update time | Correct |

### `TestExecution`

| Existing field | Source or derivation | Review |
|---|---|---|
| `report_run` | Parent run created for upload | Correct |
| `external_id` | `elements[j].id` | Maps, but is not unique in this fixture |
| `feature` | `root[i].name` | Correct |
| `suite` | No distinct source field | Unmapped/redundant for this fixture |
| `scenario` | `elements[j].name` | Correct |
| `status` | Derived from all `steps[].result.status` | Correct |
| `duration` | Sum `steps[].result.duration`, converted from ns | Semantically correct; type/unit needs definition |
| `error_message` | Aggregate failed `steps[].result.error_message` | Correct with an explicit multi-error policy |
| `tags` | Normalized union of feature/scenario tags | Correct representation after normalization |
| `file_path` | `root[i].uri` | Correct |
| `line_number` | `elements[j].line` | Correct |
| `retry_count` | No source | Defaults to zero; cannot be derived here |
| `started_at` | No source | Nullable mapping is correct |
| `finished_at` | No source | Nullable mapping is correct |
| `created_at` | Database normalization time | Correct; not execution time |

## Model review

### Fields that map correctly

- `ReportRun.project`, `uploaded_by`, `framework`, `raw_file`, `original_filename`, processing `status`, parser metadata, processing error, and audit timestamps
- All four run-level counts, provided they are computed from scenario-level derived statuses
- `TestExecution.report_run`, `feature`, `scenario`, normalized `status`, `error_message`, `tags`, `file_path`, and `line_number`
- Nullable `started_at` and `finished_at`
- `external_id` as source metadata, but not as a unique identifier

### Missing fields

For scenario-level MVP analytics, no additional field is strictly required. For faithful reconstruction and debugging, the model currently lacks:

- A stable execution identity that distinguishes expanded examples sharing an `id`; this could be a derived `source_key` or an `example_index`/example-row field.
- Structured step results. Without a `TestStepExecution` child model or a JSON metadata field, step names, step statuses, step durations, hook identity, hook failures, Gherkin step lines, implementation locations, and multiple errors are discarded.
- Explicit duration-unit documentation at the model/API boundary.
- An execution timestamp distinct from upload time when a future source provides only one run timestamp. Existing start/finish fields already cover this at execution level, but `ReportRun` has no execution start/finish timestamps.

### Unnecessary or currently unmapped fields

- `TestExecution.suite` has no distinct value in this report. Populating both `suite` and `feature` with `Test Suite` would duplicate data. Keep it only for cross-framework normalization (for example, Playwright suite nesting), otherwise remove it.
- `retry_count` cannot be populated from this fixture, but it is reasonable future-facing normalized data and should not be removed solely because this format omits it.
- `started_at` and `finished_at` are absent here but useful across other frameworks; their nullability is appropriate.
- `ReportRun.parser_version` and lifecycle/error fields are application metadata rather than report fields and are necessary for the ingestion design.

### Incorrect or risky field types

- `ReportRun.total_duration` and `TestExecution.duration` are `FloatField`. Floating-point seconds can introduce rounding error after converting integer nanoseconds. Prefer an explicitly named integer unit such as `duration_ms`/`total_duration_ms` using `PositiveBigIntegerField`, or use `DecimalField` for seconds with fixed precision. Keeping floats is acceptable for approximate UI metrics only, but the parser contract must define seconds consistently.
- `external_id` as nullable `CharField(max_length=255)` can hold observed values, but its name may imply uniqueness that the source does not provide. It must not receive a uniqueness constraint.
- `JSONField(default=list)` is appropriate for normalized tag strings. Validation should enforce a list of strings because the database field alone also accepts other JSON shapes.

### Recommended model changes

Before implementing the parser, decide the normalized fidelity level:

1. Define duration storage explicitly. Recommended: integer milliseconds for simple analytics, or integer nanoseconds if lossless Cucumber preservation matters. Rename fields to include the unit.
2. Add a derived `source_key` if executions need stable identity across imports. A candidate input is framework + feature URI + scenario ID + scenario line; do not use scenario ID alone.
3. Add `ReportRun.started_at` and `ReportRun.finished_at` only if run-time trend requirements need timestamps separate from upload time. They will remain null for this fixture.
4. If the UI must show steps/hooks or accurately retain multiple step errors, add a `TestStepExecution` model. If scenario-only analytics is the MVP, defer it and rely on the preserved raw file.
5. Retain `suite` only as a cross-framework field and document that it is blank for this Cucumber shape.
6. Keep `retry_count` at zero when metadata is absent; never infer retries from repeated IDs.

### Migration impact

- Documentation-only unit clarification: no migration.
- Renaming duration fields to unit-bearing names: schema migration; use `RenameField` where possible and update serializers/parsers.
- Changing floats to integer/decimal duration fields: data migration is required once data exists. The conversion must know the previously stored unit and rounding policy.
- Adding `source_key`: additive nullable migration first; backfill existing rows from preserved raw reports where possible, then optionally add an index. Do not make it globally unique because uniqueness is scoped to a report run.
- Adding run start/finish timestamps: additive nullable migration with low risk.
- Removing `suite`: destructive migration and potential data loss; defer until the Playwright schema is reviewed.
- Adding `TestStepExecution`: additive migration creating a new table and indexes; existing runs require optional reprocessing from `raw_file` to backfill steps.

## Review conclusion

The current models are sufficient for scenario-level counts, durations, failure summaries, and run-history analytics for this fixture. The main correctness issue to resolve before parser implementation is duration precision/unit. The main fidelity gap is the absence of normalized step/hook records. `external_id` must be treated as non-unique, and repeated IDs must not be interpreted as retries. No application model change should be made until the Playwright report shape and desired step-level UI fidelity are reviewed.
