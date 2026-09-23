import { GetRequest, PostRequest, PatchRequest, DeleteRequest } from "@/plugins/https";

export const APIGetTablesByRestaurant = (restaurantId: string) =>
  GetRequest(`/restaurants/${restaurantId}/tables`);

export const APIGetTableById = (id: string) =>
  GetRequest(`/tables/${id}`);

export const APICreateTable = (data: any) =>
  PostRequest("/tables", data);

export const APIUpdateTable = (id: string, data: any) =>
  PatchRequest(`/tables/${id}`, data);

export const APIDeleteTable = (id: string) =>
  DeleteRequest(`/tables/${id}`);
