import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";


function Dashboard(){

    const navigate = useNavigate();

    const {
        user,
        logout
    } = useAuth();


    return (

        <div className="p-10">

            <h1 className="text-4xl font-bold">
                Welcome {user?.username}
            </h1>


            <p className="mt-4">
                Role: {user?.role}
            </p>


            <button
                className="mt-6 bg-blue-600 text-white p-2 rounded"
                onClick={() => navigate("/projects")}
            >
                Projects
            </button>


            <button
                className="mt-6 ml-4 bg-black text-white p-2 rounded"
                onClick={logout}
            >
                Logout
            </button>

        </div>

    );

}


export default Dashboard;