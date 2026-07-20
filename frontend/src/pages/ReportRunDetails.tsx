import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";

import {
    dangerButton,
    errorState,
    focusLink,
    pageContainer,
    pageShell,
    panel,
    primaryButton,
} from "../components/uiStyles";
import { ConfirmDialog, EmptyState, LoadingSkeleton, MetricCard, StatusBadge } from "../components/ui";
import { deleteReportRun, getReportRun } from "../services/reportService";
import type { ReportRun } from "../services/reportService";

interface ApiErrorResponse {
    error?: string;
    detail?: string;
}

function formatDuration(duration: number) {
    return `${duration.toFixed(2)} s`;
}

function executionGroup(feature: string, suite: string) {
    return [feature, suite].filter(Boolean).join(" / ") || "—";
}

function executionSource(filePath: string, lineNumber: number | null) {
    if (!filePath) {
        return "—";
    }
    return lineNumber === null ? filePath : `${filePath}:${lineNumber}`;
}

export default function ReportRunDetails() {
    const { reportRunId } = useParams();
    const navigate = useNavigate();
    const runId = Number(reportRunId);

    const [reportRun, setReportRun] = useState<ReportRun>();
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    useEffect(() => {
        async function loadReportRun() {
            setLoading(true);
            setNotFound(false);
            setErrorMessage("");

            if (!Number.isInteger(runId) || runId <= 0) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            try {
                const response = await getReportRun(runId);
                setReportRun(response.data);
            } catch (error: unknown) {
                if (isAxiosError<ApiErrorResponse>(error) && error.response?.status === 404) {
                    setNotFound(true);
                } else if (isAxiosError<ApiErrorResponse>(error)) {
                    setErrorMessage(
                        error.response?.data?.error ??
                        error.response?.data?.detail ??
                        "The report run could not be loaded.",
                    );
                } else {
                    setErrorMessage("The report run could not be loaded.");
                }
            } finally {
                setLoading(false);
            }
        }

        void loadReportRun();
    }, [runId]);

    async function handleDelete() {
        if (!reportRun) return;

        setDeleting(true);
        setDeleteError("");

        try {
            await deleteReportRun(reportRun.id);
            navigate(`/projects/${reportRun.project}`, {
                replace: true,
                state: {
                    reportDeletionSuccess: `Report run #${reportRun.id} was deleted successfully.`,
                },
            });
        } catch (error: unknown) {
            if (isAxiosError<ApiErrorResponse>(error)) {
                setDeleteError(
                    error.response?.data?.error ??
                    error.response?.data?.detail ??
                    "The report run could not be deleted.",
                );
            } else {
                setDeleteError("The report run could not be deleted.");
            }
        } finally {
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <main className={pageShell}>
                <LoadingSkeleton id="report-details-loading-state" testId="report-details-loading" label="Loading report details" rows={6} />
            </main>
        );
    }

    if (notFound) {
        return (
            <main className={pageShell}>
                <div className="mx-auto max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-500/10 p-8 text-center">
                    <h1 className="text-2xl font-bold">Report run not found</h1>
                    <p className="mt-3 text-amber-100/80">
                        This report does not exist or you do not have access to it.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className={`${primaryButton} mt-6`}
                    >
                        Go Back
                    </button>
                </div>
            </main>
        );
    }

    if (errorMessage || !reportRun) {
        return (
            <main className={pageShell}>
                <div
                    role="alert"
                    className={`${errorState} mx-auto max-w-3xl p-8 text-center`}
                >
                    {errorMessage || "The report run could not be loaded."}
                </div>
            </main>
        );
    }

    const summaryCards = [
        { label: "Total Tests", value: reportRun.total_tests, style: "text-white" },
        { label: "Passed", value: reportRun.passed_tests, style: "text-emerald-300" },
        { label: "Failed", value: reportRun.failed_tests, style: "text-red-300" },
        { label: "Skipped", value: reportRun.skipped_tests, style: "text-amber-300" },
        { label: "Total Duration", value: formatDuration(reportRun.total_duration), style: "text-cyan-300" },
        { label: "Framework", value: reportRun.framework, style: "text-indigo-300" },
    ];

    return (
        <main className={pageShell}>
            <div id="report-details-page" data-testid="report-details" className={`${pageContainer} section-enter`}>
                <button
                    type="button"
                    onClick={() => navigate(`/projects/${reportRun.project}`)}
                    className={`${focusLink} text-sm font-medium text-indigo-300 hover:text-indigo-200`}
                >
                    ← Back to project
                </button>

                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm text-slate-400">Report Run #{reportRun.id}</p>
                        <h1 className="mt-1 break-all text-3xl font-bold tracking-tight sm:text-4xl">
                            {reportRun.original_filename}
                        </h1>
                        <p className="mt-3 text-sm text-slate-400">
                            Uploaded by {reportRun.uploaded_by} on {new Date(reportRun.created_at).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={reportRun.status} id="report-run-status-badge" />
                        <button
                            type="button"
                            id="delete-report-button"
                            data-testid="delete-report"
                            onClick={() => setConfirmDeleteOpen(true)}
                            disabled={deleting}
                            className={dangerButton}
                        >
                            {deleting ? "Deleting..." : "Delete run"}
                        </button>
                    </div>
                </div>

                {deleteError && (
                    <div role="alert" className={`${errorState} mt-5`}>
                        {deleteError}
                    </div>
                )}

                <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {summaryCards.map((card) => <MetricCard key={card.label} id={`report-summary-${card.label.toLowerCase().replaceAll(" ", "-")}`} label={card.label} value={card.value} />)}
                </section>

                <section className={`${panel} mt-8`} aria-labelledby="executions-heading">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 id="executions-heading" className="text-xl font-semibold">Test Executions</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Normalized scenarios parsed from this report run.
                            </p>
                        </div>
                        <span className="text-sm text-slate-400">
                            {reportRun.executions.length} executions
                        </span>
                    </div>

                    {reportRun.executions.length === 0 ? (
                        <div className="mt-6"><EmptyState id="executions-empty-state" testId="executions-empty" title="No test executions" description="No normalized test executions are available for this report run." /></div>
                    ) : (
                        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
                            <table id="test-executions-table" data-testid="test-executions-table" className="w-full min-w-[1200px] text-left text-sm">
                                <thead className="table-header">
                                    <tr>
                                        <th className="px-4 py-3">Scenario</th>
                                        <th className="px-4 py-3">Feature / Suite</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Duration</th>
                                        <th className="px-4 py-3 text-right">Retries</th>
                                        <th className="px-4 py-3">Tags</th>
                                        <th className="px-4 py-3">Source</th>
                                        <th className="px-4 py-3">Error</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {reportRun.executions.map((execution) => (
                                        <tr id={`execution-row-${execution.id}`} data-testid={`execution-row-${execution.id}`} key={execution.id} className={`align-top text-slate-200 ${execution.status === "FAILED" ? "bg-rose-500/[0.045]" : "bg-slate-900/20"}`}>
                                            <td className="max-w-64 px-4 py-4 font-medium">
                                                {execution.scenario}
                                            </td>
                                            <td className="max-w-56 px-4 py-4 text-slate-300">
                                                {executionGroup(execution.feature, execution.suite)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <StatusBadge status={execution.status} id={`execution-status-${execution.id}`} />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                {formatDuration(execution.duration)}
                                            </td>
                                            <td className="px-4 py-4 text-right">{execution.retry_count}</td>
                                            <td className="max-w-48 px-4 py-4">
                                                {execution.tags.length > 0
                                                    ? execution.tags.join(", ")
                                                    : "—"}
                                            </td>
                                            <td className="max-w-64 break-all px-4 py-4 text-slate-400">
                                                {executionSource(execution.file_path, execution.line_number)}
                                            </td>
                                            <td className="max-w-md px-4 py-4 text-rose-200">
                                                {execution.status === "FAILED" && execution.error_message
                                                    ? <details open><summary className="cursor-pointer rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">Failure details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-400/15 bg-rose-950/20 p-3 font-mono text-xs leading-5 text-rose-100">{execution.error_message}</pre></details>
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                <ConfirmDialog open={confirmDeleteOpen} id="delete-report-details-dialog" testId="delete-report-dialog" title="Delete report run?" description={`Report run #${reportRun.id} (${reportRun.original_filename}) and all normalized executions will be permanently deleted.`} confirmLabel="Delete report" busy={deleting} onCancel={() => setConfirmDeleteOpen(false)} onConfirm={() => void handleDelete()} />
            </div>
        </main>
    );
}
