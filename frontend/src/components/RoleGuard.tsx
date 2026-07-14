import { useAuth } from "../contexts/AuthContext";


function RoleGuard({
    allowed,
    children
}:{
    allowed:string[],
    children:React.ReactNode
}){


    const {user}=useAuth();


    if(
        !user ||
        !allowed.includes(user.role)
    ){

        return null;

    }


    return children;

}


export default RoleGuard;