import { getCookie } from "cookies-next";

export const getCurrentUserName = () => getCookie("username");
export const getCurrentUserToken = () => getCookie("token");
export const getCurrentUserRole = () => getCookie("role");
