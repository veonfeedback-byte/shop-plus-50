// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Order } from "@/app/lib/types"; // ✅ shared Order type

export default function Profile() {
  const [profile, setProfile] = useState<{
    name?: string;
    phone?: string;
    address?: string;
  }>({});
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setProfile(JSON.parse(localStorage.getItem("profile") || "{}"));
    setOrders(JSON.parse(localStorage.getItem("myOrders") || "[]"));
  }, []);

  function requestReturn(id: string) {
    const next: Order[] = orders.map((o) =>
      o.id === id
        ? {
            ...o,
            status: "return_requested", // ✅ type-safe, matches OrderStatus union
            notes:
              "User requested return; if within 7 days, admin will review.",
          }
        : o
    );
    setOrders(next);
    localStorage.setItem("myOrders", JSON.stringify(next));
    alert("Return requested. Admin will review (7-day window).");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      {profile?.name ? (
        <div className="rounded-xl shadow p-3 bg-white">
          <div className="font-semibold">{profile.name}</div>
          <div className="text-sm">{profile.phone}</div>
          <div className="text-sm">{profile.address}</div>
        </div>
      ) : (
        <div className="rounded-xl shadow p-3 bg-white text-sm text-gray-600">
          Not logged in. Your first order details will be saved locally so it
          feels like you’re logged in.
        </div>
      )}

      <div>
        <div className="text-lg font-semibold mb-2">Your Orders</div>
        {orders.length === 0 && <div>No orders yet.</div>}
        <div className="space-y-3">
          {orders.map((o) => {
            const within7 =
              Date.now() - new Date(o.created_at).getTime() <=
              7 * 24 * 60 * 60 * 1000;
            return (
              <div
                key={o.id}
                className="rounded-xl shadow p-3 bg-white space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    Order #{o.id.slice(0, 8)}
                  </div>
                  <div className="px-2 py-0.5 rounded-full border text-xs">
                    {o.status}
                  </div>
                </div>
                <div className="text-sm text-gray-600">{o.notes}</div>
                <div className="text-sm">
                  {o.items.length} item(s) •{" "}
                  {new Date(o.created_at).toLocaleString()}
                </div>
                <button
                  className="px-3 py-1 border rounded"
                  disabled={!within7}
                  onClick={() => requestReturn(o.id)}
                >
                  Request Return
                </button>
                {!within7 && (
                  <span className="text-xs text-gray-500 ml-2">
                    Return window passed (7 days)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
