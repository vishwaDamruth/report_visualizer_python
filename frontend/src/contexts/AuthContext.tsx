import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import api from "../services/api";


interface User {
    id: number;
    username: string;
    email: string;
    role: string;
}


interface AuthContextType {

    user: User | null;

    login: (
        username: string,
        password: string
    ) => Promise<void>;

    logout: () => void;

    loading: boolean;
}


const AuthContext = createContext<AuthContextType | null>(null);



export function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {

    const [user, setUser] = useState<User | null>(null);

    const [loading, setLoading] = useState(true);



    useEffect(() => {

        const loadUser = async () => {

            const token = localStorage.getItem("access");


            if (!token) {

                setLoading(false);

                return;

            }


            try {

                const response = await api.get(
                    "/users/me/"
                );

                setUser(response.data);


            } catch {

                logout();

            }


            setLoading(false);

        };


        loadUser();


    }, []);




    const login = async (
        username:string,
        password:string
    ) => {


        const response = await api.post(
            "/login/",
            {
                username,
                password,
            }
        );


        localStorage.setItem(
            "access",
            response.data.access
        );


        localStorage.setItem(
            "refresh",
            response.data.refresh
        );


        const userResponse = await api.get(
            "/users/me/"
        );


        setUser(userResponse.data);

    };




    const logout = () => {

        localStorage.removeItem("access");

        localStorage.removeItem("refresh");

        setUser(null);

    };



    return (

        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                loading,
            }}
        >

            {children}

        </AuthContext.Provider>

    );

}



export function useAuth() {

    const context = useContext(AuthContext);


    if (!context) {

        throw new Error(
            "useAuth must be inside AuthProvider"
        );

    }


    return context;

}