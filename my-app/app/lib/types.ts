// app/lib/types.ts

export type CartItem = {
  id: string;
  code?: string;
  title: string;
  image: string;
  price: number;
  qty: number;

  // 🔹 add these optional fields
  note?: string;
  size?: string | null;
  color?: string | null;

  meta?: {
    original_price: number;
    coupon?: string | null;
    discount_pct: number;
    discount_amount_per_unit: number;
  };
};

export type OrderStatus = "pending" | "approved" | "rejected" | "delivered";

export type Order = {
  id: string;
  user_name: string;
  phone: string;
  address: string;
  items: CartItem[];
  status: OrderStatus;
  created_at: string;
  notes?: string;
};
