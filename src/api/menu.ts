import { GetRequest, PostRequest, PatchRequest, DeleteRequest } from "@/plugins/https";

// Categories
export const APIGetCategoriesByRestaurant = (restaurantId: string) =>
  GetRequest(`/restaurants/${restaurantId}/menu-categories`);

export const APIGetCategoryById = (id: string) =>
  GetRequest(`/menu-categories/${id}`);

export const APICreateCategory = (data: any) =>
  PostRequest("/menu-categories", data);

export const APIUpdateCategory = (id: string, data: any) =>
  PatchRequest(`/menu-categories/${id}`, data);

export const APIDeleteCategory = (id: string) =>
  DeleteRequest(`/menu-categories/${id}`);

// Menu Items
export const APIGetMenuItemsByRestaurant = (restaurantId: string) =>
  GetRequest(`/restaurants/${restaurantId}/menu-items`);

export const APIGetMenuItemsByCategory = (categoryId: string) =>
  GetRequest(`/menu-categories/${categoryId}/menu-items`);

export const APIGetMenuItemById = (id: string) =>
  GetRequest(`/menu-items/${id}`);

export const APICreateMenuItem = (data: any) =>
  PostRequest("/menu-items", data);

export const APIUpdateMenuItem = (id: string, data: any) =>
  PatchRequest(`/menu-items/${id}`, data);

export const APIDeleteMenuItem = (id: string) =>
  DeleteRequest(`/menu-items/${id}`);

// Item Addons
export const APIAssignAddonsToMenuItem = (id: string, data: any) =>
  PostRequest(`/menu-items/${id}/addons`, data);

export const APIGetAddonsByMenuItem = (id: string) =>
  GetRequest(`/menu-items/${id}/addons`);
