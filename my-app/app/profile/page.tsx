"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  List,
  History,
} from "lucide-react";
import Link from "next/link";


type CartItem = {
  id: string;
  category: string;
  subcategory: string;
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
  delivery_charges: number; 
  created_at: string;
  completed_at?: string | null;
  expires_at?: string | null;
  track_link?: string | null;
};

type ReturnReasonState = {
  [orderId: string]: string;
};

export default function Profile() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<DBOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"current" | "history">("current");

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ name: "", phone: "", address: "", email: "" });
  const [authLoading, setAuthLoading] = useState(false);


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

  // ---- LOGIN ----
  async function handleLogin() {
    if (!form.email) return toast.error("Enter email");

    setAuthLoading(true);
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", form.email)
      .maybeSingle();

    setAuthLoading(false);

    if (error) return toast.error("Login failed");
    if (!existing) {
      toast.error("Email not found. Please signup.");
      return;
    }

    localStorage.setItem("profile", JSON.stringify(existing));
    setProfile(existing);
    toast.success("Logged in successfully!");
  }

  // ---- SIGNUP ----
  async function handleSignup() {
    const { name, phone, address, email } = form;
    if (!name || !phone || !address || !email) return toast.error("Fill all fields");

    setAuthLoading(true);

    // Check existing email
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      setAuthLoading(false);
      toast.error("Email already exists, please login.");
      return;
    }

    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert([{ name, phone, address, email }])
      .select("*")
      .single();

    setAuthLoading(false);

    if (error) return toast.error("Signup failed");

    localStorage.setItem("profile", JSON.stringify(newProfile));
    setProfile(newProfile);
    toast.success("Account created successfully!");
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

  // Restore profile from localStorage on page load
  useEffect(() => {
    const savedProfile = localStorage.getItem("profile");
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, []);

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
          .select("*")
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

          // After setting profileId and before return cleanup:
          const profileChannel = supabase
            .channel(`profile-realtime-${profileId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "profiles",
                filter: `id=eq.${profileId}`,
              },
              (payload) => {
                if (payload.eventType === "UPDATE") {
                  setProfile(payload.new);
                  localStorage.setItem("profile", JSON.stringify(payload.new));
                  toast.info("Profile updated");
                }
              }
            )
            .subscribe();


        return () => {
          supabase.removeChannel(channel); // orders
          supabase.removeChannel(profileChannel); // profile

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

  function handleLogout() {
  localStorage.removeItem("profile");
  setProfile(null);
  toast("Logged out");
}


  return (
    <div className="space-y-8 p-5 bg-gray-50 min-h-screen">
     
      <div className="flex">

        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        
        {profile?.email ? (
        <button
          onClick={handleLogout}
          className="ml-auto px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
        >
          Logout
        </button>

        ) : null}
        </div>
        

      {/* Profile Info */}
      {profile?.email ? (
        <div className="rounded-2xl bg-white shadow p-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.name?.[0] || "U"}
          </div>

          <div className="flex-1 space-y-1">
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
        <div className="rounded-2xl bg-white shadow p-5 space-y-3">
          {authMode === "login" ? (
            <>
              <input
                type="email"
                placeholder="Enter email"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <button
                onClick={handleLogin}
                disabled={authLoading}
                className={`w-full py-2 rounded font-medium ${
                  authLoading
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {authLoading ? "Logging in..." : "Login"}
              </button>
              <p
                onClick={() => setAuthMode("signup")}
                className="text-sm text-blue-600 cursor-pointer underline"
              >
                Not already login? Signup now
              </p>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Full Name"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Phone"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                type="text"
                placeholder="Address"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border rounded px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <button
                onClick={handleSignup}
                disabled={authLoading}
                className={`w-full py-2 rounded font-medium ${
                  authLoading
                    ? "bg-green-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                } text-white`}
              >
                {authLoading ? "Signing up..." : "Signup"}
              </button>
              <p
                onClick={() => setAuthMode("login")}
                className="text-sm text-blue-600 cursor-pointer underline"
              >
                Already have an account? Login
              </p>
            </>
          )}
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
             
            const grandTotal = o.total + (o.delivery_charges || 0);

            return (
                <div
                  key={o.id}
                    className="relative rounded-xl bg-white shadow-md border border-gray-100 p-4 hover:shadow-lg transition"
                  >
                  {/* Order header with ID + date */}
                  <div className="grid justify-between items-center mb-3 gap-3">
                    
                    <div className="text-xs text-gray-500 flex items-center gap-1">
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
                  </div>

                {/* Items list */}
                <div className="space-y-3">
                  {o.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border-b last:border-0 pb-2"
                    >
                      <div className="flex-1 pr-3">
                        <div className="text-xs font-mono text-gray-600">
                           Order ID: <span className="font-semibold">{o.id.slice(0, 7)}</span>
                        </div>
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
                          <>
                            <div className="mt-1 text-sm">
                              price: Rs {item.discountedPrice || item.price}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-gray-900">
                              Total: Rs {(item.discountedPrice || item.price) * item.qty}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                      
                    {/* Each item image links to its own product */}
                    <Link
                      href={`/shop/${encodeURIComponent(item.category)}/${encodeURIComponent(item.subcategory)}/${encodeURIComponent(item.id)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 h-20 rounded-lg border bg-gray-50 overflow-hidden flex-shrink-0"
                    >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-gray-400 flex items-center justify-center h-full">
                        No Image
                      </div>
                    )}
                  </Link>

                    </div>
                  ))}
                </div>  
                {/* Order total */}
                <div className="border-t pt-2 mt-2 text-sm font-bold text-gray-900">
                  Order total: Rs {grandTotal}
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

                    {o.track_link && (
                  <a
                    href={o.track_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs rounded-md border border-indigo-400 text-indigo-600 hover:bg-indigo-50"
                    onClick={(e) => e.stopPropagation()} // 👈 prevent Link wrapping from hijacking
                  >
                    Track Order
                  </a>
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
