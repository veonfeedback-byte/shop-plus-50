// app/admin/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { LogOut, Search } from "lucide-react";
import { toast } from "sonner";

/* ---------------- types ---------------- */
type CartItem = {
  id: string;
  title: string;
  image?: string;
  qty: number;
  price: number;
  size?: string | null;
  color?: string | null;
  discountedPrice?: number;
};

type OrderRow = {
  id: string;
  profile_id?: string | null;
  items?: CartItem[] | any;
  total?: number;
  status?: string;
  created_at?: string;
  completed_at?: string | null;
  profile?: any | null;
  return_reason?: string | null;
};

const ADMIN_PASSWORD = "ShopAdmin786";
const STATUS_OPTIONS = [
  "pending",
  "approved",
  "out_for_delivery",
  "dropped",
  "completed",
  "cancelled",
  "return_pending",
  "return_approved",
  "return_dropped",
  "return_completed",
];

export default function AdminOrdersPage() {
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
  const realtimeRef = useRef<{ channels: any[] }>({ channels: [] });

  // restore admin session from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem("admin_logged_in");
      if (v === "1") setAdminLoggedIn(true);
    } catch {}
  }, []);

  // fetch all orders + profiles + return reasons and merge
  async function fetchAllOrders() {
    setLoading(true);
    try {
      const [
        { data: ordersData, error: ordersErr },
        { data: profilesData },
        { data: reasonsData },
      ] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("return_reason").select("*"),
      ]);

      if (ordersErr) {
        console.error("ordersErr", ordersErr);
        toast.error("Failed to load orders");
        setLoading(false);
        return;
      }

      const profilesMap = (profilesData || []).reduce((acc: Record<string, any>, p: any) => {
        if (p?.id) acc[p.id] = p;
        return acc;
      }, {});

      const reasonsMap = (reasonsData || []).reduce((acc: Record<string, string>, r: any) => {
        if (r?.order_id) acc[r.order_id] = r.reason || null;
        return acc;
      }, {});

      const merged: OrderRow[] = (ordersData || []).map((o: any) => {
        let parsedItems = o.items;
        try {
          if (typeof o.items === "string") parsedItems = JSON.parse(o.items);
        } catch {}
        return {
          ...o,
          items: parsedItems,
          profile: profilesMap[o.profile_id] ?? null,
          return_reason: reasonsMap[o.id] ?? null,
        } as OrderRow;
      });

      setOrders(merged);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  // realtime sync
  useEffect(() => {
    if (!adminLoggedIn) return;
    fetchAllOrders();

    const channels: any[] = [];
    const subscribeTo = (tableName: string) => {
      try {
        const ch = supabase
          .channel(`admin-${tableName}`)
          .on("postgres_changes", { event: "*", schema: "public", table: tableName }, () => {
            setTimeout(() => fetchAllOrders(), 150);
          })
          .subscribe();
        channels.push(ch);
      } catch (err) {
        console.warn("subscribe error", tableName, err);
      }
    };

    subscribeTo("orders");
    subscribeTo("profiles");
    subscribeTo("return_reason");

    realtimeRef.current.channels = channels;
    return () => {
      try {
        channels.forEach((ch) => supabase.removeChannel(ch));
      } catch {}
      realtimeRef.current.channels = [];
    };
  }, [adminLoggedIn]);

  // login handler
  function handleAdminLogin() {
    if (password === ADMIN_PASSWORD) {
      try {
        localStorage.setItem("admin_logged_in", "1");
      } catch {}
      setAdminLoggedIn(true);
      toast.success("Admin logged in");
    } else {
      toast.error("Wrong password");
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem("admin_logged_in");
    } catch {}
    setAdminLoggedIn(false);
    setOrders([]);
    toast("Logged out");
  }

  // update status
  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingMap((s) => ({ ...s, [orderId]: true }));
    try {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      if (error) throw error;
      toast.success("Status updated");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update status");
    } finally {
      setUpdatingMap((s) => {
        const copy = { ...s };
        delete copy[orderId];
        return copy;
      });
    }
  }

  // filter
  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    return String(o.id).toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {!adminLoggedIn ? (
        <div className="max-w-md mx-auto mt-20 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            className="w-full border rounded px-3 py-2 mb-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdminLogin();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdminLogin}
              className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
            >
              Login
            </button>
            <button
              onClick={() => {
                setPassword("");
              }}
              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded"
            >
              Clear
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Simple admin panel — password is <code>****</code> (client-side).
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-semibold flex-1">Orders admin</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>

          <div className="bg-white p-4 rounded shadow mb-4 flex gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                placeholder="Search order by id..."
                className="w-full border rounded px-3 py-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <button
                onClick={fetchAllOrders}
                className="px-4 py-2 bg-indigo-600 text-white rounded"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-auto bg-white rounded shadow">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left bg-gray-100">
                  <th className="p-3">Order id</th>
                  <th className="p-3">User details</th>
                  <th className="p-3">Order details</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-600">
                      No orders
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="p-3 align-top font-mono text-xs">{o.id}</td>

                      <td className="p-3 align-top">
                        <div className="text-sm font-semibold">{o.profile?.name ?? "—"}</div>
                        <div className="text-xs text-gray-600">ID: {o.profile?.id ?? "—"}</div>
                        <div className="text-xs text-gray-600">
                          Phone: {o.profile?.phone ?? "—"}
                        </div>
                        <div className="text-xs text-gray-600">
                          Address: {o.profile?.address ?? "—"}
                        </div>
                        <div className="text-xs text-gray-600">
                          Email: {o.profile?.email ?? "—"}
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="space-y-1">
                          {(o.items || []).map((it: any, idx: number) => {
                            const totalForItem =
                              (Number(it.discountedPrice ?? it.price) || 0) *
                              (Number(it.qty) || 0);
                            return (
                              <div key={idx} className="text-xs border-b pb-1 mb-1">
                                <div className="font-medium">{it.title}</div>
                                <div className="text-gray-600">id: {it.id}</div>
                                {it.size && <div className="text-gray-600">size: {it.size}</div>}
                                {it.color && <div className="text-gray-600">color: {it.color}</div>}
                                <div className="text-gray-600">qty: {it.qty}</div>
                                <div className="text-gray-600">
                                  price: {it.discountedPrice ?? it.price}
                                </div>
                                <div className="text-gray-700 font-semibold">
                                  Total: Rs {totalForItem}
                                </div>
                              </div>
                            );
                          })}
                          <div className="text-sm font-semibold">
                            Order total: Rs{" "}
                            {o.total ??
                              (o.items || []).reduce(
                                (s: number, it: any) =>
                                  s +
                                  ((Number(it.discountedPrice ?? it.price) || 0) *
                                    (Number(it.qty) || 0)),
                                0
                              )}
                          </div>

                          {o.return_reason ? (
                            <div className="mt-2 text-xs text-amber-700">
                              Return reason: {o.return_reason}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <select
                          value={o.status ?? ""}
                          onChange={(e) => updateStatus(o.id, e.target.value)}
                          disabled={!!updatingMap[o.id]}
                          className="border rounded px-2 py-1"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        {updatingMap[o.id] && (
                          <div className="text-xs text-gray-500 mt-1">Updating…</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
