"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { toast } from "sonner";
import Image from "next/image";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  List,
  History,
} from "lucide-react";

type CartItem = {
  id: string;
  title: string;
  image?: string;
  qty: number;
  price: number;
  discountedPrice?: number;
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

type ReturnReasonState = {
  [orderId: string]: string;
};

export default function Profile() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"current" | "history">("current");

  const [showReturnInput, setShowReturnInput] = useState<{ [id: string]: boolean }>({});
  const [returnReason, setReturnReason] = useState<ReturnReasonState>({});

  function isReturnWindowOpen(order: DBOrder) {
    if (!order.completed_at) return false;
    if (!order.expires_at) return true;
    return new Date(order.expires_at).getTime() > Date.now();
  }

  // Cancel order
  async function cancelOrder(orderId: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o))
    );
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);

    if (error) {
      toast.error(error.message);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "pending" } : o))
      );
    } else {
      toast.success("Order cancelled");
    }
  }

  // Request return with reason
  async function requestReturn(orderId: string) {
    const reason = returnReason[orderId] || "";
    if (!reason.trim()) {
      toast.error("Please enter a reason for return");
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "return_pending" } : o
      )
    );

    const { error } = await supabase.rpc("request_return", {
      p_order_id: orderId,
      p_reason: reason,
    });

    if (error) {
      toast.error(error.message || "Failed to request return");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "completed" } : o
        )
      );
    } else {
      toast.success("Return requested");
      setShowReturnInput((prev) => ({ ...prev, [orderId]: false }));
      setReturnReason((prev) => ({ ...prev, [orderId]: "" }));
    }
  }

  // Auto approve pending orders
  useEffect(() => {
    if (!orders.length) return;
    orders.forEach((order) => {
      if (order.status === "pending") {
        const createdTime = new Date(order.created_at).getTime();
        const elapsed = Date.now() - createdTime;

        if (elapsed >= 180000) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === order.id ? { ...o, status: "approved" } : o
            )
          );
        } else {
          const timeout = setTimeout(() => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: "approved" } : o
              )
            );
          }, 180000 - elapsed);
          return () => clearTimeout(timeout);
        }
      }
    });
  }, [orders]);

  // Load profile & orders
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

        const { data: initialOrders } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false });

        setOrders(initialOrders || []);
        setLoading(false);

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

  // Filter orders by view
  const filteredOrders = orders.filter((o) =>
    view === "current"
      ? ["pending", "approved", "out_for_delivery"].includes(o.status)
      : [
          "completed",
          "cancelled",
          "return_pending",
          "return_approved",
          "return_dropped",
          "return_completed",
        ].includes(o.status)
  );

  return (
    <div className="space-y-8 p-5 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Info */}
      {profile?.name || profile?.email ? (
        <div className="rounded-2xl bg-white shadow p-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.name?.[0] || "U"}
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-pink-500" /> {profile.name}
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
        <div className="rounded-xl bg-white shadow p-4 text-sm text-gray-600">
          Not logged in. Place an order to save your info.
        </div>
      )}

      {/* Orders */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" /> Your Orders
        </h2>

        {/* Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setView("current")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              view === "current"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <List className="w-4 h-4" /> Current Orders
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              view === "history"
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>

        {loading && <div>Loading…</div>}
        {!loading && filteredOrders.length === 0 && (
          <div className="text-gray-500">No {view} orders yet.</div>
        )}

        <div className="space-y-4">
          {filteredOrders.map((o) => {
            const canCancel = o.status === "pending";
            const canRequestReturn =
              o.status === "completed" && isReturnWindowOpen(o);

            return (
              <div
                key={o.id}
                className="relative rounded-xl bg-white shadow-md border border-gray-100 p-4"
              >
                {/* Order date/time top-right */}
                <div className="top-3 right-3 text-xs text-gray-500 flex items-center gap-1">
                  <History className="w-3 h-3" />
                  {new Date(o.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  {new Date(o.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>

                {/* Items list */}
                <div className="space-y-3">
                  {o.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border-b last:border-0 pb-2"
                    >
                      <div className="flex-1 pr-3">
                        <div className="font-medium text-gray-800">
                          {item.title}{" "}
                          <span className="text-gray-500 text-sm">
                            ×{item.qty}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          {item.discountedPrice ? (
                            <>
                              <span className="line-through text-gray-400 mr-2">
                                Rs {item.price}
                              </span>
                              <span className="text-green-600 font-semibold">
                                Rs {item.discountedPrice}
                              </span>
                            </>
                          ) : (
                            <span className="font-semibold text-gray-800">
                              Rs {item.price}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-20 h-20 rounded-lg border bg-gray-50 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-xs text-gray-400 flex items-center justify-center h-full">
                            No Image
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order footer + return reason */}
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex gap-2">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        o.status === "pending"
                          ? "bg-gray-100 text-gray-700"
                          : o.status === "approved"
                          ? "bg-blue-100 text-blue-700"
                          : o.status === "out_for_delivery"
                          ? "bg-yellow-100 text-yellow-700"
                          : o.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : o.status.includes("return")
                          ? "bg-purple-100 text-purple-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {o.status.replace("_", " ")}
                    </span>
                    {canCancel && (
                      <button
                        onClick={() => cancelOrder(o.id)}
                        className="px-3 py-1 text-xs rounded-md border border-red-400 text-red-600 hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    )}
                    {canRequestReturn && !showReturnInput[o.id] && (
                      <button
                        onClick={() =>
                          setShowReturnInput((prev) => ({
                            ...prev,
                            [o.id]: true,
                          }))
                        }
                        className="px-3 py-1 text-xs rounded-md border border-purple-400 text-purple-600 hover:bg-purple-50"
                      >
                        Return
                      </button>
                    )}
                  </div>

                  {showReturnInput[o.id] && (
                    <div className="flex flex-col gap-2 mt-2">
                      <textarea
                        className="w-full border rounded p-2"
                        placeholder="Enter reason for return..."
                        value={returnReason[o.id] || ""}
                        onChange={(e) =>
                          setReturnReason((prev) => ({
                            ...prev,
                            [o.id]: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => requestReturn(o.id)}
                          className="px-4 py-2 rounded bg-purple-600 text-white text-sm"
                        >
                          Submit Return
                        </button>
                        <button
                          onClick={() =>
                            setShowReturnInput((prev) => ({
                              ...prev,
                              [o.id]: false,
                            }))
                          }
                          className="px-4 py-2 rounded border text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
