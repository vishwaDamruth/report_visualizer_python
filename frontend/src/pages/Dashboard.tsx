import { useNavigate } from "react-router-dom";

import { pageContainer, pageShell, panel, primaryButton, secondaryButton } from "../components/uiStyles";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader } from "../components/ui";

function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    return (
        <main className={pageShell}>
            <div id="main-dashboard" data-testid="main-dashboard" className={`${pageContainer} section-enter`}>
                <section className={`${panel} mx-auto mt-4 max-w-4xl sm:mt-10 sm:p-8`}>
                    <PageHeader eyebrow="Dashboard" title={`Welcome, ${user?.username ?? ""}`} description="Access your automation projects and review normalized test-report analytics." />
                    <p className="mt-4 text-slate-300">
                        Signed in with the <span className="font-medium text-white">{user?.role}</span> role.
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button id="dashboard-projects-button" data-testid="dashboard-projects" type="button" className={primaryButton} onClick={() => navigate("/projects")}>
                            View projects
                        </button>
                        <button id="dashboard-sign-out-button" data-testid="dashboard-sign-out" type="button" className={secondaryButton} onClick={logout}>
                            Sign out
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Dashboard;
