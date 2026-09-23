import { GetRequest } from "@/plugins/https";

export const APIGetRestaurants = () =>
  GetRequest("/restaurants");
