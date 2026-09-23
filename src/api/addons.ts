import { GetRequest, PostRequest, PatchRequest, DeleteRequest } from "@/plugins/https";

export const APIGetAddonsByRestaurant = (restaurantId: string) =>
  GetRequest(`/restaurants/${restaurantId}/addons`);

export const APIGetAddonById = (id: string) =>
  GetRequest(`/addons/${id}`);

export const APICreateAddon = (data: any) =>
  PostRequest("/addons", data);

export const APIUpdateAddon = (id: string, data: any) =>
  PatchRequest(`/addons/${id}`, data);

export const APIDeleteAddon = (id: string) =>
  DeleteRequest(`/addons/${id}`);
