export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  address?: string;
  menuType?: "BAR" | "KITCHEN";
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  qrUrl?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  menuType?: "BAR" | "KITCHEN";
  isActive?: boolean;
  restaurantId: string;
  restaurant?: Restaurant;
  createdAt?: string;
  updatedAt?: string;
  qrUrl?: string;
}

export interface Table {
  id: string;
  restaurantId: string;
  number: string;
  menuType?: "BAR" | "KITCHEN";
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Addon {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  menuType?: "BAR" | "KITCHEN";
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  category?: MenuCategory;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  menuType?: "BAR" | "KITCHEN";
  isActive?: boolean;
  addons?: Addon[];
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderItemAddon {
  id?: string;
  orderItemId?: string;
  addonId: string;
  addon?: Addon;
  quantity: number;
  price?: number;
  name?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem?: MenuItem;
  quantity: number;
  price?: number;
  subtotal?: number;
  addons?: OrderItemAddon[];
  orderItemAddons?: OrderItemAddon[];
  createdAt?: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  tableId: string;
  table?: Table;
  status: OrderStatus;
  totalAmount?: number;
  notes?: string;
  items?: OrderItem[];
  orderItems?: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
}
