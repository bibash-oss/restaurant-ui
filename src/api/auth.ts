import { PostRequest, GetRequest } from "@/plugins/https";

export const APILogin = (data: any) => PostRequest("/auth/login", data);
export const APIGetMe = () => GetRequest("/auth/me");