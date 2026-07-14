import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";


function Login() {


    const navigate = useNavigate();

    const { login } = useAuth();


    const [username,setUsername] = useState("");

    const [password,setPassword] = useState("");



    const handleLogin = async()=>{

        try {

            await login(
                username,
                password
            );


            navigate("/dashboard");


        } catch (error:any) {

    console.log(error.response);

    alert("Login Failed");

}

    };



 return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">

        {/* Background Glow */}
        <div className="absolute w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl top-20 left-20"></div>
        <div className="absolute w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl bottom-20 right-20"></div>

        <div className="relative w-[420px] rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-10">

            <h1 className="text-4xl font-extrabold text-white text-center">
                Automation Visualizer
            </h1>

            <p className="text-slate-300 text-center mt-2 mb-8">
                Monitor • Analyze • Improve
            </p>

            <input
                className="w-full rounded-xl bg-slate-800/60 border border-slate-600 text-white px-4 py-3 mb-5 outline-none focus:border-indigo-400 transition"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />

            <input
                type="password"
                className="w-full rounded-xl bg-slate-800/60 border border-slate-600 text-white px-4 py-3 mb-6 outline-none focus:border-indigo-400 transition"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <button
                onClick={handleLogin}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 transition py-3 text-white font-semibold shadow-lg hover:scale-[1.02]"
            >
                Sign In
            </button>

        </div>

    </div>
);

}


export default Login;