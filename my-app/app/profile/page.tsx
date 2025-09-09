"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type DBOrder = {
  id: string;
  status:
    | "pending"
    | "approved"
    | "dropped"
    | "complete"
    | "cancelled"
    | "return_requested"
    | "return_approved"
    | "return_dropped"
    | "return_completed";
  items: any[];
  total: number;
  created_at: string;
  completed_at?: string | null;
  size?: string | null;
  color?: string | null;
  note?: string | null;
};

export default function Profile() {
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ check if within 7 days
  function within7Days(ts?: string | null) {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return Date.now() - t <= 7 * 24 * 60 * 60 * 1000;
  }

  async function loadOrders(email: string) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileRow) {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", profileRow.id)
        .order("created_at", { ascending: false });

      setOrders(orders || []);
    }
    setLoading(false);
  }

  // 🔹 cancel order
  async function cancelOrder(orderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (!error) {
      setOrders((os) =>
        os.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
      );
    }
  }

  // 🔹 request return
  async function requestReturn(orderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "return_requested" })
      .eq("id", orderId);

    if (!error) {
      setOrders((os) =>
        os.map((o) =>
          o.id === orderId ? { ...o, status: "return_requested" } : o
        )
      );
    }
  }

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    setProfile(p);
    if (p.email) loadOrders(p.email);
    else setLoading(false);
  }, []);

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Profile</h1>

      {profile?.name || profile?.email ? (
        <div className="rounded-xl shadow p-3 bg-white">
          <div className="font-semibold">{profile.name}</div>
          <div className="text-sm">{profile.email}</div>
          <div className="text-sm">{profile.phone}</div>
          <div className="text-sm">{profile.address}</div>
        </div>
      ) : (
        <div className="rounded-xl shadow p-3 bg-white text-sm text-gray-600">
          Not logged in. Place an order to save your info.
        </div>
      )}

      <div>
        <div className="text-lg font-semibold mb-2">Your Orders</div>
        {loading && <div>Loading…</div>}
        {!loading && orders.length === 0 && <div>No orders yet.</div>}

        <div className="space-y-3">
          {orders.map((o) => {
            const canCancel = o.status === "pending";
            const canRequestReturn =
              o.status === "complete" &&
              within7Days(o.completed_at || o.created_at);

            return (
              <div
                key={o.id}
                className="rounded-xl shadow p-3 bg-white space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Order #{o.id.slice(0, 8)}</div>
                  <div className="px-2 py-0.5 rounded-full border text-xs">
                    {o.status}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {o.items?.length} item(s) •{" "}
                  {new Date(o.created_at).toLocaleString()}
                </div>

                <div className="flex gap-2 mt-2">
                  {canCancel && (
                    <button
                      onClick={() => cancelOrder(o.id)}
                      className="px-3 py-1 border rounded"
                    >
                      Cancel Order
                    </button>
                  )}
                  {o.status === "approved" && (
                    <button
                      className="px-3 py-1 border rounded opacity-50 cursor-not-allowed"
                      disabled
                    >
                      Cancel (disabled)
                    </button>
                  )}
                  {canRequestReturn && (
                    <button
                      onClick={() => requestReturn(o.id)}
                      className="px-3 py-1 border rounded"
                    >
                      Request Return
                    </button>
                  )}
                </div>

                {(o.size || o.color || o.note) && (
                  <div className="text-xs text-gray-700 mt-1">
                    {o.size && <>Size: {o.size} • </>}
                    {o.color && <>Color: {o.color} • </>}
                    {o.note && <>Note: {o.note}</>}
                  </div>
                )}

                <div className="text-sm font-semibold mt-1">
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
