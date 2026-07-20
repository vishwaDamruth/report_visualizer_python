import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import {
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    getProjectDashboard,
    type DashboardExecution,
    type ProjectDashboardResponse,
} from "../services/reportService";
import {
    errorState,
    focusLink,
    panel,
} from "./uiStyles";
import { EmptyState, LoadingSkeleton, MetricCard, StatusBadge } from "./ui";

interface ProjectDashboardProps {
    projectId: number;
    refreshKey: number;
}

interface ApiErrorResponse {
    error?: string;
    detail?: string;
}

function formatDuration(duration: number | null) {
    if (duration === null) return "—";
    if (duration < 60) return `${duration.toFixed(2)} s`;
    const minutes = Math.floor(duration / 60);
    return `${minutes}m ${(duration % 60).toFixed(1)}s`;
}

function ExecutionTable({
    title,
    description,
    executions,
    selectorPrefix,
}: {
    title: string;
    description: string;
    executions: DashboardExecution[];
    selectorPrefix: "recent-failures" | "slowest";
}) {
    const navigate = useNavigate();

    return (
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 sm:p-5">
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{description}</p>

            {executions.length === 0 ? (
                <p className="mt-5 rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                    No executions to display.
                </p>
            ) : (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="pb-3 pr-4">Scenario</th>
                                <th className="pb-3 pr-4">Feature / suite</th>
                                <th className="pb-3 pr-4">Run</th>
                                <th className="pb-3 text-right">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {executions.map((execution) => (
                                <tr
                                    id={`${selectorPrefix}-execution-row-${execution.id}`}
                                    data-testid={`${selectorPrefix}-execution-row-${execution.id}`}
                                    key={execution.id}
                                    tabIndex={0}
                                    role="link"
                                    onClick={() => navigate(`/reports/${execution.report_run_id}`)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            navigate(`/reports/${execution.report_run_id}`);
                                        }
                                    }}
                                    className="interactive-row text-slate-300"
                                >
                                    <td className="max-w-64 py-3 pr-4">
                                        <p className="truncate font-medium text-slate-100" title={execution.scenario}>
                                            {execution.scenario}
                                        </p>
                                        {execution.error_message && (
                                            <p className="mt-1 truncate text-xs text-red-300" title={execution.error_message}>
                                                {execution.error_message}
                                            </p>
                                        )}
                                    </td>
                                    <td className="max-w-48 py-3 pr-4">
                                        <p className="truncate" title={execution.feature || execution.suite}>
                                            {execution.feature || execution.suite || "—"}
                                        </p>
                                        {execution.file_path && (
                                            <p className="mt-1 truncate text-xs text-slate-500" title={execution.file_path}>
                                                {execution.file_path}{execution.line_number !== null ? `:${execution.line_number}` : ""}
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <p>#{execution.report_run_id}</p>
                                        <p className="mt-1 max-w-36 truncate text-xs text-slate-500" title={execution.report_filename}>
                                            {execution.report_filename}
                                        </p>
                                    </td>
                                    <td className="whitespace-nowrap py-3 text-right">
                                        {formatDuration(execution.duration)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const chartColors = {
    passed: "#34d399",
    failed: "#f87171",
    skipped: "#fbbf24",
    unknown: "#94a3b8",
    passRate: "#22d3ee",
    duration: "#a78bfa",
};

function ChartEmptyState({ message }: { message: string }) {
    return (
        <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">
            {message}
        </div>
    );
}

function DashboardCharts({ dashboard }: { dashboard: ProjectDashboardResponse }) {
    const distribution = [
        { name: "Passed", value: dashboard.outcome_distribution.passed, color: chartColors.passed },
        { name: "Failed", value: dashboard.outcome_distribution.failed, color: chartColors.failed },
        { name: "Skipped", value: dashboard.outcome_distribution.skipped, color: chartColors.skipped },
        ...(dashboard.outcome_distribution.unknown > 0
            ? [{ name: "Unknown", value: dashboard.outcome_distribution.unknown, color: chartColors.unknown }]
            : []),
    ];
    const hasDistribution = distribution.some((item) => item.value > 0);

    return (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div id="outcome-distribution-chart" data-testid="outcome-distribution-chart" className="chart-card rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-lg shadow-black/10 sm:p-5">
                <h3 className="font-semibold text-white">Test outcome distribution</h3>
                <p className="mt-1 text-sm text-slate-400">Passed, failed, and skipped tests from completed runs.</p>
                <div className="mt-4" aria-label="Test outcome distribution chart">
                    {!hasDistribution ? (
                        <ChartEmptyState message="No completed test outcomes are available." />
                    ) : (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart accessibilityLayer>
                                    <Pie
                                        data={distribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        innerRadius="42%"
                                        outerRadius="68%"
                                        paddingAngle={2}
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        {distribution.map((item) => (
                                            <Cell key={item.name} fill={item.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), "Tests"]} />
                                    <Legend verticalAlign="bottom" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            <div id="pass-rate-trend-chart" data-testid="pass-rate-trend-chart" className="chart-card rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-lg shadow-black/10 sm:p-5">
                <h3 className="font-semibold text-white">Pass-rate trend</h3>
                <p className="mt-1 text-sm text-slate-400">Pass rate by completed report run in upload order.</p>
                <div className="mt-4" aria-label="Pass-rate trend chart">
                    {dashboard.pass_rate_trend.length === 0 ? (
                        <ChartEmptyState message="No completed report runs are available for this trend." />
                    ) : (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dashboard.pass_rate_trend} margin={{ top: 12, right: 16, left: 0, bottom: 8 }} accessibilityLayer>
                                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="report_run_id"
                                        tickFormatter={(value) => `#${value}`}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        label={{ value: "Report run", position: "insideBottom", offset: -4, fill: "#94a3b8" }}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tickFormatter={(value) => `${value}%`}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        width={48}
                                        label={{ value: "Pass rate (%)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                                    />
                                    <Tooltip
                                        labelFormatter={(reportRunId) => `Report run #${reportRunId}`}
                                        formatter={(value) => [value === null ? "No tests" : `${Number(value).toFixed(2)}%`, "Pass rate"]}
                                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#475569", borderRadius: "0.75rem" }}
                                        labelStyle={{ color: "#e2e8f0" }}
                                    />
                                    <Legend verticalAlign="top" height={32} />
                                    <Line
                                        type="monotone"
                                        dataKey="pass_rate"
                                        name="Pass rate"
                                        stroke={chartColors.passRate}
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: chartColors.passRate }}
                                        activeDot={{ r: 6 }}
                                        connectNulls={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            <div id="duration-trend-chart" data-testid="duration-trend-chart" className="chart-card rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-lg shadow-black/10 sm:p-5 xl:col-span-2">
                <h3 className="font-semibold text-white">Total-duration trend</h3>
                <p className="mt-1 text-sm text-slate-400">Total duration per completed report run, in seconds.</p>
                <div className="mt-4" aria-label="Total-duration trend chart">
                    {dashboard.duration_trend.length === 0 ? (
                        <ChartEmptyState message="No completed report runs are available for this trend." />
                    ) : (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dashboard.duration_trend} margin={{ top: 12, right: 16, left: 0, bottom: 8 }} accessibilityLayer>
                                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="report_run_id"
                                        tickFormatter={(value) => `#${value}`}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        label={{ value: "Report run", position: "insideBottom", offset: -4, fill: "#94a3b8" }}
                                    />
                                    <YAxis
                                        tickFormatter={(value) => `${value}s`}
                                        stroke="#94a3b8"
                                        tick={{ fontSize: 12 }}
                                        width={56}
                                        label={{ value: "Duration (seconds)", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
                                    />
                                    <Tooltip
                                        labelFormatter={(reportRunId) => `Report run #${reportRunId}`}
                                        formatter={(value) => [`${Number(value).toFixed(2)} s`, "Total duration"]}
                                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#475569", borderRadius: "0.75rem" }}
                                        labelStyle={{ color: "#e2e8f0" }}
                                    />
                                    <Legend verticalAlign="top" height={32} />
                                    <Line
                                        type="monotone"
                                        dataKey="total_duration"
                                        name="Total duration (seconds)"
                                        stroke={chartColors.duration}
                                        strokeWidth={2}
                                        dot={{ r: 4, fill: chartColors.duration }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProjectDashboard({ projectId, refreshKey }: ProjectDashboardProps) {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<ProjectDashboardResponse>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await getProjectDashboard(projectId);
            setDashboard(response.data);
        } catch (requestError: unknown) {
            if (isAxiosError<ApiErrorResponse>(requestError)) {
                setError(
                    requestError.response?.data?.error ??
                    requestError.response?.data?.detail ??
                    "Project analytics could not be loaded.",
                );
            } else {
                setError("Project analytics could not be loaded.");
            }
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        // The request callback owns the asynchronous loading-state transition.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDashboard();
    }, [loadDashboard, refreshKey]);

    if (loading) {
        return (
            <section className={`${panel} mt-8 sm:mt-10`} aria-labelledby="project-dashboard-heading">
                <h2 id="project-dashboard-heading" className="text-xl font-semibold">Project Dashboard</h2>
                <div className="mt-6"><LoadingSkeleton id="dashboard-loading-state" testId="dashboard-loading" label="Loading project analytics" rows={5} /></div>
            </section>
        );
    }

    if (error || !dashboard) {
        return (
            <section className={`${panel} mt-8 sm:mt-10`} aria-labelledby="project-dashboard-heading">
                <h2 id="project-dashboard-heading" className="text-xl font-semibold">Project Dashboard</h2>
                <div role="alert" className={`${errorState} mt-6`}>
                    <p>{error || "Project analytics could not be loaded."}</p>
                    <button type="button" onClick={() => void loadDashboard()} className={`${focusLink} mt-3 font-semibold underline underline-offset-4`}>
                        Try again
                    </button>
                </div>
            </section>
        );
    }

    if (dashboard.metrics.total_report_runs === 0) {
        return (
            <section className={`${panel} mt-8 sm:mt-10`} aria-labelledby="project-dashboard-heading">
                <h2 id="project-dashboard-heading" className="text-xl font-semibold">Project Dashboard</h2>
                <div className="mt-6"><EmptyState id="dashboard-empty-state" testId="dashboard-empty" title="Upload a report to see project analytics" description="Summary metrics, trends, and execution highlights will appear here." /></div>
            </section>
        );
    }

    const { metrics, latest_run: latestRun } = dashboard;
    const cards = [
        ["Total runs", metrics.total_report_runs.toLocaleString(), "All processing states", "text-white"],
        ["Total tests", metrics.total_tests_executed.toLocaleString(), "Completed runs", "text-white"],
        ["Passed", metrics.passed_tests.toLocaleString(), "Completed runs", "text-emerald-300"],
        ["Failed", metrics.failed_tests.toLocaleString(), "Completed runs", "text-red-300"],
        ["Skipped", metrics.skipped_tests.toLocaleString(), "Completed runs", "text-amber-300"],
        ["Pass rate", metrics.overall_pass_rate === null ? "—" : `${metrics.overall_pass_rate.toFixed(2)}%`, "Completed runs", "text-cyan-300"],
        ["Average duration", formatDuration(metrics.average_run_duration), "Per completed run", "text-violet-300"],
    ];

    return (
        <section id="project-dashboard-summary" data-testid="dashboard-summary" className={`${panel} section-enter mt-8 sm:mt-10`} aria-labelledby="project-dashboard-heading">
            <div>
                <h2 id="project-dashboard-heading" className="text-xl font-semibold">Project Dashboard</h2>
                <p className="mt-2 text-sm text-slate-400">Test analytics include completed report runs only.</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(([label, value, note], index) => {
                    const slug = label.toLowerCase().replaceAll(" ", "-");
                    const tone = index === 2 ? "success" : index === 3 ? "danger" : index === 4 ? "warning" : index >= 5 ? "info" : "default";
                    return <MetricCard key={label} id={`dashboard-${slug}-card`} testId={`dashboard-${slug}-card`} label={label} value={value} context={note} tone={tone as "default" | "success" | "danger" | "warning" | "info"} />;
                })}

                <div id="latest-run-card" data-testid="latest-run-card" className="metric-card rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/10 sm:col-span-2 lg:col-span-1">
                    <p className="text-sm text-slate-400">Latest run</p>
                    {latestRun ? (
                        <button type="button" onClick={() => navigate(`/reports/${latestRun.id}`)} className={`${focusLink} mt-2 block w-full text-left`}>
                            <span className="flex items-center justify-between gap-2">
                                <span className="truncate font-semibold text-white" title={latestRun.original_filename}>
                                    #{latestRun.id} · {latestRun.original_filename}
                                </span>
                                <StatusBadge status={latestRun.status} />
                            </span>
                            <span className="mt-2 block text-xs text-slate-500">
                                Uploaded {new Date(latestRun.created_at).toLocaleString()} by {latestRun.uploaded_by}
                            </span>
                        </button>
                    ) : (
                        <p className="mt-2 text-slate-400">No uploads yet.</p>
                    )}
                </div>
            </div>

            <DashboardCharts dashboard={dashboard} />

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <ExecutionTable
                    title="Recent failed executions"
                    description="The five latest failures from completed runs."
                    executions={dashboard.recent_failed_executions}
                    selectorPrefix="recent-failures"
                />
                <ExecutionTable
                    title="Slowest executions"
                    description="The five longest executions from completed runs."
                    executions={dashboard.slowest_executions}
                    selectorPrefix="slowest"
                />
            </div>
        </section>
    );
}
