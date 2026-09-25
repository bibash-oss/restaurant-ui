import { GetRequest, PostRequest } from "@/plugins/https";

export interface CheckoutAddonPayload {
  addonId: string;
  quantity: number;
}

export interface CheckoutItemPayload {
  menuItemId: string;
  quantity: number;
  addons?: CheckoutAddonPayload[];
}

export interface CreateCheckoutPayload {
  restaurantId: string;
  tableId: string;
  notes?: string;
  items: CheckoutItemPayload[];
}

export interface CheckoutSessionData {
  checkoutUrl: string;
  sessionId: string;
  totalAmount: number;
}

export interface PaymentSessionResponse {
  sessionId: string;
  status: "PENDING" | "COMPLETED" | "EXPIRED";
  orderId?: string;
  order?: {
    id: string;
    restaurantId: string;
    tableId: string;
    status: string;
    paymentStatus?: string;
    totalAmount: number;
    notes?: string;
    createdAt?: string;
    table?: {
      id: string;
      number: string;
    };
    restaurant?: {
      id: string;
      name: string;
      address?: string;
    };
    orderItems?: Array<{
      id: string;
      menuItemId: string;
      quantity: number;
      price: number;
      menuItem?: {
        id: string;
        name: string;
        description?: string;
        price?: number;
      };
      orderItemAddons?: Array<{
        id: string;
        addonId: string;
        quantity: number;
        price?: number;
        addon?: {
          id: string;
          name: string;
          price: number;
        };
      }>;
    }>;
  };
}

/**
 * Creates a Stripe Checkout session on the backend
 */
export const APICreateCheckoutSession = (data: CreateCheckoutPayload) =>
  PostRequest("/payments/checkout", data);

/**
 * Fetches status of a Stripe session after redirect
 */
export const APIGetPaymentSession = (sessionId: string) =>
  GetRequest(`/payments/session/${sessionId}`);
