import { useEffect, useRef } from "react";

import { dangerButton, secondaryButton } from "./uiStyles";

export function PageHeader({ eyebrow, title, description, actions, id }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; id?: string }) {
    return <header id={id} className="page-header flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0">{eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">{eyebrow}</p>}<h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>{description && <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">{description}</p>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}</header>;
}

export function MetricCard({ id, label, value, context, tone = "default", testId }: { id?: string; label: string; value: React.ReactNode; context?: string; tone?: "default" | "success" | "danger" | "warning" | "info"; testId?: string }) {
    const tones = { default: "text-white", success: "text-emerald-300", danger: "text-rose-300", warning: "text-amber-300", info: "text-cyan-300" };
    return <article id={id} data-testid={testId} className="metric-card group rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-xl"><div className="flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone === "success" ? "bg-emerald-400" : tone === "danger" ? "bg-rose-400" : tone === "warning" ? "bg-amber-400" : tone === "info" ? "bg-cyan-400" : "bg-slate-500"}`} /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p></div><p className={`metric-value mt-3 text-2xl font-bold tabular-nums tracking-tight ${tones[tone]}`}>{value}</p>{context && <p className="mt-2 text-xs leading-5 text-slate-500">{context}</p>}</article>;
}

export function StatusBadge({ status, id }: { status: string; id?: string }) {
    const styles: Record<string, string> = { COMPLETED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", PASSED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", FAILED: "border-rose-400/30 bg-rose-400/10 text-rose-300", PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-300", SKIPPED: "border-amber-400/30 bg-amber-400/10 text-amber-300", PROCESSING: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300", UNKNOWN: "border-slate-400/30 bg-slate-400/10 text-slate-300" };
    return <span id={id} className={`status-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${styles[status] ?? styles.UNKNOWN}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

export function LoadingSkeleton({ label = "Loading", rows = 3, id, testId }: { label?: string; rows?: number; id?: string; testId?: string }) {
    return <div id={id} data-testid={testId} role="status" aria-label={label} className="loading-skeleton space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-5"><span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, index) => <div key={index} aria-hidden="true" className={`skeleton-line h-4 rounded-full bg-slate-800 ${index === 0 ? "w-2/3" : index === rows - 1 ? "w-1/2" : "w-full"}`} />)}</div>;
}

export function EmptyState({ id, title, description, action, testId }: { id?: string; title: string; description?: string; action?: React.ReactNode; testId?: string }) {
    return <div id={id} data-testid={testId} className="empty-state rounded-2xl border border-dashed border-slate-700 bg-slate-900/25 px-5 py-10 text-center"><div aria-hidden="true" className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-800/60 text-slate-400">—</div><h3 className="mt-4 font-semibold text-slate-200">{title}</h3>{description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel, busy, onCancel, onConfirm, id = "confirm-dialog", testId = "confirm-dialog" }: { open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void; id?: string; testId?: string }) {
    const cancelRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
    useEffect(() => { if (!open) return; const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); }; document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, [busy, onCancel, open]);
    if (!open) return null;
    return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}><div id={id} data-testid={testId} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"><div aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30">!</div><h2 id={`${id}-title`} className="mt-5 text-xl font-semibold">{title}</h2><p id={`${id}-description`} className="mt-2 text-sm leading-6 text-slate-400">{description}</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button ref={cancelRef} type="button" className={secondaryButton} onClick={onCancel} disabled={busy}>Cancel</button><button id={`${id}-confirm-button`} type="button" className={dangerButton} onClick={onConfirm} disabled={busy}>{busy ? "Deleting..." : confirmLabel}</button></div></div></div>;
}
