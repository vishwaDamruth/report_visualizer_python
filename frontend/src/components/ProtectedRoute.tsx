import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { LoadingSkeleton } from "./ui";


function ProtectedRoute({
    children
}:{
    children:React.ReactNode
}) {


    const {
        user,
        loading
    } = useAuth();



    if(loading){

        return (
            <main className="min-h-screen bg-slate-950 px-4 py-16 text-white">
                <LoadingSkeleton id="authentication-loading-state" testId="authentication-loading" label="Restoring your session" rows={4} />
            </main>
        );

    }



    if(!user){

        return (
            <Navigate to="/login" replace />
        );

    }


    return children;

}


export default ProtectedRoute;
