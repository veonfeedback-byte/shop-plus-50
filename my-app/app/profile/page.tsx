"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type DBOrder = {
  id: string;
  status: string;
  items: any[];
  total: number;
  created_at: string;
  size?: string | null;
  color?: string | null;
  note?: string | null;
};

export default function Profile() {
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    setProfile(p);

    if (p.email) {
      supabase
        .from("profiles")
        .select("id")
        .eq("email", p.email)
        .single()
        .then(async ({ data }) => {
          if (data) {
            const { data: orders } = await supabase
              .from("orders")
              .select("*")
              .eq("user_id", data.id)
              .order("created_at", { ascending: false });
            setOrders(orders || []);
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
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
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl shadow p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Order #{o.id.slice(0, 8)}</div>
                <div className="px-2 py-0.5 rounded-full border text-xs">{o.status}</div>
              </div>
              <div className="text-sm text-gray-600">
                {o.items?.length} item(s) • {new Date(o.created_at).toLocaleString()}
              </div>
              <div className="text-sm font-semibold mt-1">Total: Rs {o.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
