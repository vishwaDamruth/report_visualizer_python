import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import CursorGlow from "./CursorGlow";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const projectsActive = location.pathname.startsWith("/projects") || location.pathname.startsWith("/reports");

    function signOut() {
        logout();
        navigate("/login");
    }

    return (
        <div className="app-shell min-h-screen bg-slate-950 text-white" data-testid="app-shell">
            <CursorGlow />
            <header id="application-topbar" className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-md" data-testid="application-topbar">
                <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <NavLink id="application-brand-link" to="/dashboard" className="group flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400" data-testid="application-brand">
                        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-300 ring-1 ring-indigo-400/30">AV</span>
                        <span className="hidden truncate text-sm font-semibold tracking-tight sm:block">Automation Visualizer</span>
                    </NavLink>

                    <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                        <NavLink id="nav-dashboard-link" data-testid="nav-dashboard" to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>Dashboard</NavLink>
                        <NavLink id="nav-projects-link" data-testid="nav-projects" to="/projects" className={() => `nav-link ${projectsActive ? "nav-link-active" : ""}`}>Projects</NavLink>
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden text-right md:block">
                            <p className="text-xs font-medium text-slate-200">{user?.username}</p>
                            <p className="text-[11px] text-slate-500">{user?.role}</p>
                        </div>
                        <button id="sign-out-button" data-testid="sign-out" type="button" onClick={signOut} className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:px-4">
                            Sign out
                        </button>
                    </div>
                </div>
            </header>
            <div className="relative z-10">{children}</div>
        </div>
    );
}
