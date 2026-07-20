import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { field, primaryButton } from "../components/uiStyles";
import { useAuth } from "../contexts/AuthContext";

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            await login(username, password);
            navigate("/dashboard");
        } catch {
            setError("Sign in failed. Check your username and password and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-10 text-white sm:px-6">
            <div aria-hidden="true" className="absolute left-0 top-10 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl sm:left-20 sm:h-96 sm:w-96" />
            <div aria-hidden="true" className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl sm:right-20 sm:h-96 sm:w-96" />

            <form id="login-form" data-testid="login-form" onSubmit={handleLogin} className="section-enter relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/85 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
                <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Automation Visualizer</h1>
                <p className="mt-3 text-center text-sm text-slate-300 sm:text-base">Monitor · Analyze · Improve</p>

                <div className="mt-8 space-y-5">
                    <label className="block text-sm font-medium text-slate-200" htmlFor="login-username-input">
                        Username
                        <input
                            id="login-username-input"
                            data-testid="login-username"
                            name="username"
                            autoComplete="username"
                            required
                            className={`${field} mt-2`}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                        />
                    </label>

                    <label className="block text-sm font-medium text-slate-200" htmlFor="login-password-input">
                        Password
                        <input
                            id="login-password-input"
                            data-testid="login-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className={`${field} mt-2`}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </label>
                </div>

                {error && <div id="login-error-message" data-testid="login-error" role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

                <button id="login-submit-button" data-testid="login-submit" type="submit" disabled={submitting} className={`${primaryButton} mt-6 w-full active:translate-y-px`}>
                    {submitting ? "Signing in..." : "Sign in"}
                </button>
            </form>
        </main>
    );
}

export default Login;
