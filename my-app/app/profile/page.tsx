"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { toast } from "sonner";
import { User, Mail, Phone, MapPin } from "lucide-react";

type CartItem = {
  id: string;
  title: string;
  image?: string;
  qty: number;
  price: number;
};

type DBOrder = {
  id: string;
  status:
    | "pending"
    | "approved"
    | "out_for_delivery"
    | "dropped"
    | "completed"
    | "cancelled"
    | "return_pending"
    | "return_approved"
    | "return_dropped"
    | "return_completed";
  items: CartItem[];
  total: number;
  created_at: string;
  completed_at?: string | null;
  expires_at?: string | null;
};

export default function Profile() {
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);

  function isReturnWindowOpen(order: DBOrder) {
    if (!order.completed_at) return false;
    if (!order.expires_at) return true; // still active until expiry
    return new Date(order.expires_at).getTime() > Date.now();
  }

  // Cancel order
  async function cancelOrder(orderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    if (error) toast.error(error.message);
  }

  // Request return
  async function requestReturn(orderId: string) {
    const { error } = await supabase.rpc("request_return", {
      p_order_id: orderId,
    });
    if (error) toast.error(error.message || "Failed to request return");
  }

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    setProfile(p);

    if (!p.email) {
      setLoading(false);
      return;
    }

    supabase
      .from("profiles")
      .select("id")
      .eq("email", p.email)
      .single()
      .then(async ({ data: profileRow }) => {
        if (!profileRow) {
          setLoading(false);
          return;
        }

        const profileId = profileRow.id;

        // Initial load
        const { data: initialOrders } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false });

        setOrders(initialOrders || []);
        setLoading(false);

        // 🔥 Realtime updates (direct state update, no refetch)
        const channel = supabase
          .channel(`orders-realtime-${profileId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `profile_id=eq.${profileId}`,
            },
            (payload) => {
              setOrders((prev) => {
                if (payload.eventType === "INSERT") {
                  toast.success("New order placed");
                  return [payload.new as DBOrder, ...prev];
                }
                if (payload.eventType === "UPDATE") {
                  toast.info(`Order updated → ${payload.new.status}`);
                  return prev.map((o) =>
                    o.id === payload.new.id ? { ...o, ...payload.new } : o
                  );
                }
                if (payload.eventType === "DELETE") {
                  toast("Order removed");
                  return prev.filter((o) => o.id !== payload.old.id);
                }
                return prev;
              });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      });
  }, []);

  return (
    <div className="space-y-8 p-6 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Info */}
      {profile?.name || profile?.email ? (
        <div className="rounded-2xl shadow-lg bg-white p-6 flex items-center gap-6 border border-gray-200">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-400 to-blue-400 flex items-center justify-center text-white text-3xl font-bold shadow-md">
            {profile.name?.[0] || "U"}
          </div>
          <div className="space-y-2">
            <div className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-500" /> {profile.name}
            </div>
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" /> {profile.email}
            </div>
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" /> {profile.phone}
            </div>
            <div className="text-sm text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" /> {profile.address}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl shadow p-4 bg-white text-sm text-gray-600">
          Not logged in. Place an order to save your info.
        </div>
      )}

      {/* Orders */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Orders</h2>
        {loading && <div>Loading…</div>}
        {!loading && orders.length === 0 && (
          <div className="text-gray-500">No orders yet.</div>
        )}

        <div className="grid gap-5">
          {orders.map((o) => {
            const canCancel = o.status === "pending";
            const canRequestReturn =
              o.status === "completed" && isReturnWindowOpen(o);

            return (
              <div
                key={o.id}
                className="rounded-2xl shadow-md border border-gray-200 p-5 bg-white transition hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">
                    Order #{o.id.slice(0, 8)}
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      o.status === "pending"
                        ? "bg-gray-100 text-gray-700 border"
                        : o.status === "approved"
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : o.status === "out_for_delivery"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                        : o.status === "completed"
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : o.status.includes("return")
                        ? "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-red-100 text-red-700 border border-red-300"
                    }`}
                  >
                    {o.status.replace("_", " ")}
                  </span>
                </div>

                <div className="text-sm text-gray-500 mt-1">
                  {o.items?.length} item(s) •{" "}
                  {new Date(o.created_at).toLocaleString()}
                </div>

                {/* Product preview */}
                <div className="flex flex-wrap gap-3 mt-4">
                  {o.items?.map((it, idx) => (
                    <div
                      key={idx}
                      className="w-20 h-20 rounded-lg border bg-gray-50 overflow-hidden relative"
                    >
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image}
                          alt={it.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-xs text-gray-400 flex items-center justify-center h-full">
                          No Img
                        </div>
                      )}
                      <div className="absolute bottom-0 right-0 text-xs bg-black/70 text-white px-1 rounded-tl">
                        ×{it.qty}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-4">
                  {canCancel && (
                    <button
                      onClick={() => cancelOrder(o.id)}
                      className="px-4 py-1.5 text-sm rounded-lg border border-red-400 text-red-600 hover:bg-red-50 transition"
                    >
                      Cancel Order
                    </button>
                  )}
                  {o.status === "approved" && (
                    <button
                      className="px-4 py-1.5 text-sm rounded-lg border opacity-50 cursor-not-allowed"
                      disabled
                    >
                      Cancel ⓘ
                    </button>
                  )}
                  {canRequestReturn ? (
                    <button
                      onClick={() => requestReturn(o.id)}
                      className="px-4 py-1.5 text-sm rounded-lg border border-purple-400 text-purple-600 hover:bg-purple-50 transition"
                    >
                      Request Return
                    </button>
                  ) : (
                    o.status === "completed" && (
                      <button
                        className="px-4 py-1.5 text-sm rounded-lg border opacity-50 cursor-not-allowed"
                        disabled
                      >
                        Return Unavailable
                      </button>
                    )
                  )}
                </div>

                <div className="text-base font-bold text-gray-800 mt-4">
                  Total: Rs {o.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
