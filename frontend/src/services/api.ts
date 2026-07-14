import axios from "axios";

const api = axios.create({

    baseURL: "http://127.0.0.1:8000/api",

});


// Every request made using "api"
// will pass through here FIRST.
//
// We automatically attach the JWT token
// so we don't have to manually write
// Authorization headers everywhere.

api.interceptors.request.use(

    (config) => {

        const token = localStorage.getItem("access");


        if (token) {

            config.headers.Authorization = `Bearer ${token}`;

        }


        return config;

    }

);


export default api;