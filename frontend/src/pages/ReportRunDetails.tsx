import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";

import { getReportRun } from "../services/reportService";
import type {
    ReportProcessingStatus,
    ReportRun,
    TestExecutionStatus,
} from "../services/reportService";

interface ApiErrorResponse {
    error?: string;
    detail?: string;
}

const runStatusStyles: Record<ReportProcessingStatus, string> = {
    PENDING: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    PROCESSING: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    COMPLETED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    FAILED: "border-red-400/30 bg-red-500/10 text-red-200",
};

const executionStatusStyles: Record<TestExecutionStatus, string> = {
    PASSED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    FAILED: "border-red-400/30 bg-red-500/10 text-red-200",
    SKIPPED: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    UNKNOWN: "border-slate-400/30 bg-slate-500/10 text-slate-200",
};

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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 p-8 text-white">
                Loading report run...
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-slate-950 p-8 text-white">
                <div className="mx-auto max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-500/10 p-8 text-center">
                    <h1 className="text-2xl font-bold">Report run not found</h1>
                    <p className="mt-3 text-amber-100/80">
                        This report does not exist or you do not have access to it.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-500"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (errorMessage || !reportRun) {
        return (
            <div className="min-h-screen bg-slate-950 p-8 text-white">
                <div
                    role="alert"
                    className="mx-auto max-w-3xl rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center text-red-100"
                >
                    {errorMessage || "The report run could not be loaded."}
                </div>
            </div>
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
        <div className="min-h-screen bg-slate-950 p-8 text-white">
            <div className="mx-auto max-w-7xl">
                <button
                    type="button"
                    onClick={() => navigate(`/projects/${reportRun.project}`)}
                    className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
                >
                    ← Back to project
                </button>

                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm text-slate-400">Report Run #{reportRun.id}</p>
                        <h1 className="mt-1 break-all text-3xl font-bold">
                            {reportRun.original_filename}
                        </h1>
                        <p className="mt-3 text-sm text-slate-400">
                            Uploaded by {reportRun.uploaded_by} on {new Date(reportRun.created_at).toLocaleString()}
                        </p>
                    </div>
                    <span className={`inline-flex self-start rounded-full border px-4 py-2 text-sm font-semibold ${runStatusStyles[reportRun.status]}`}>
                        {reportRun.status}
                    </span>
                </div>

                <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {summaryCards.map((card) => (
                        <div
                            key={card.label}
                            className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl"
                        >
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                {card.label}
                            </p>
                            <p className={`mt-3 text-2xl font-bold ${card.style}`}>
                                {card.value}
                            </p>
                        </div>
                    ))}
                </section>

                <section className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Test Executions</h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Normalized scenarios parsed from this report run.
                            </p>
                        </div>
                        <span className="text-sm text-slate-400">
                            {reportRun.executions.length} executions
                        </span>
                    </div>

                    {reportRun.executions.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-600 py-8 text-center text-sm text-slate-400">
                            No test executions are available for this run.
                        </div>
                    ) : (
                        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full min-w-[1200px] text-left text-sm">
                                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
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
                                        <tr key={execution.id} className="align-top bg-slate-900/30 text-slate-200">
                                            <td className="max-w-64 px-4 py-4 font-medium">
                                                {execution.scenario}
                                            </td>
                                            <td className="max-w-56 px-4 py-4 text-slate-300">
                                                {executionGroup(execution.feature, execution.suite)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${executionStatusStyles[execution.status]}`}>
                                                    {execution.status}
                                                </span>
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
                                            <td className="max-w-md whitespace-pre-wrap px-4 py-4 text-red-200">
                                                {execution.status === "FAILED" && execution.error_message
                                                    ? execution.error_message
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
