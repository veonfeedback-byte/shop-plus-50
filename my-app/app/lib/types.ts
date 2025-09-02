// app/lib/types.ts

// Cart items in localStorage
export type CartItem = {
  id: string;
  code?: string;
  title: string;
  image?: string;
  price: number; // always number
  qty: number;
};

// Allowed order statuses
export type OrderStatus = "pending" | "approved" | "dropped" | "return_requested";

// Orders saved in localStorage
export type Order = {
  id: string;
  user_name: string;
  phone: string;
  address: string;
  items: CartItem[];
  status: OrderStatus;
  created_at: string;
  notes: string;
};
