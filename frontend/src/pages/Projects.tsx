import { useEffect, useState } from "react";
import api from "../services/api";


interface Project {

    id: number;

    name: string;

    description: string;

    created_by: string;

}


function Projects() {


    const [projects, setProjects] = useState<Project[]>([]);


    const [name, setName] = useState("");

    const [description, setDescription] = useState("");



    // Runs when page loads
    // Fetch existing projects from backend
    useEffect(() => {

        fetchProjects();

    }, []);



    async function fetchProjects(){

        try {

            const response = await api.get(
                "/projects/"
            );


            setProjects(
                response.data
            );


        } catch(error){

            console.log(error);

        }

    }




    async function createProject(){


        try {


            await api.post(
                "/projects/",
                {
                    name,
                    description
                }
            );


            // Refresh project list after creation
            fetchProjects();


            // Clear form
            setName("");

            setDescription("");


        } catch(error){

            console.log(error);

        }

    }




    return (

        <div className="min-h-screen bg-slate-950 text-white p-10">


            <h1 className="text-4xl font-bold mb-8">
                Projects
            </h1>



            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-10">


                <h2 className="text-xl mb-4">
                    Create Project
                </h2>



                <input

                    className="
                    w-full 
                    p-3 
                    rounded-lg 
                    bg-slate-800 
                    mb-3
                    "

                    placeholder="Project name"

                    value={name}

                    onChange={
                        e=>setName(e.target.value)
                    }

                />



                <input

                    className="
                    w-full 
                    p-3 
                    rounded-lg 
                    bg-slate-800 
                    mb-4
                    "

                    placeholder="Description"

                    value={description}

                    onChange={
                        e=>setDescription(e.target.value)
                    }

                />



                <button

                    onClick={createProject}

                    className="
                    bg-indigo-600
                    px-6
                    py-3
                    rounded-xl
                    hover:bg-indigo-500
                    "

                >

                    Create

                </button>


            </div>





            <div className="grid grid-cols-3 gap-6">


                {
                    projects.map(
                        project=>(


                        <div

                        key={project.id}

                        className="
                        bg-white/10
                        p-6
                        rounded-2xl
                        border
                        border-white/10
                        "

                        >


                            <h2 className="text-2xl font-bold">

                                {project.name}

                            </h2>


                            <p className="text-gray-300 mt-3">

                                {project.description}

                            </p>



                            <p className="text-sm text-gray-400 mt-4">

                                Created by:
                                {" "}
                                {project.created_by}

                            </p>



                        </div>


                        )

                    )
                }


            </div>


        </div>

    );


}


export default Projects;