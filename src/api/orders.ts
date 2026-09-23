import { GetRequest, PostRequest, PatchRequest } from "@/plugins/https";

export const APIGetOrdersByRestaurant = (restaurantId: string) =>
  GetRequest(`/restaurants/${restaurantId}/orders`);

export const APIGetOrdersByTable = (tableId: string) =>
  GetRequest(`/tables/${tableId}/orders`);

export const APIGetOrderById = (id: string) =>
  GetRequest(`/orders/${id}`);

export const APICreateOrder = (data: any) =>
  PostRequest("/orders", data);

export const APIUpdateOrderStatus = (id: string, data: any) =>
  PatchRequest(`/orders/${id}/status`, data);

export const APIGetItemsByOrder = (orderId: string) =>
  GetRequest(`/orders/${orderId}/items`);

export const APIGetOrderItemById = (id: string) =>
  GetRequest(`/order-items/${id}`);
