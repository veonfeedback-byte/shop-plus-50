"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";

type CartItem = {
  id: string;
  code?: string;
  title: string;
  image?: string;
  price: number;
  qty: number;
  size?: string | null;
  color?: string | null;
  note?: string | null;
    meta?: {
    original_price: number;
    coupon?: string | null;
    discount_pct: number;
    discount_amount_per_unit: number;
    delivery_charge: number;         // ✅ new
    subtotal: number;                // ✅ new
    total_with_delivery: number;     // ✅ new
  };
};

type Profile = {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<Profile>({});
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load cart & profile
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    if (Array.isArray(stored)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = stored.map((it: any) => ({
        ...it,
        price: typeof it.price === "string" ? parseFloat(it.price) : it.price,
      }));
      setItems(mapped);
      setSelected(Object.fromEntries(mapped.map((it: CartItem) => [it.id, false])));
    }

    const loadProfile = async () => {
      const localProfile = JSON.parse(localStorage.getItem("profile") || "{}");
      if (localProfile.email) {
        setProfile((prev) => ({ ...prev, email: localProfile.email }));
      }

      if (localProfile.email) {
        const { data: existingProfile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", localProfile.email)
          .maybeSingle();
        if (error) {
          console.error(error);
        } else if (existingProfile) {
          setProfile({
            id: existingProfile.id,
            name: existingProfile.name || "",
            phone: existingProfile.phone || "",
            address: existingProfile.address || "",
            email: existingProfile.email,
          });
          setEditing(false);
        } else {
          setProfile({
            name: localProfile.name || "",
            phone: localProfile.phone || "",
            address: localProfile.address || "",
            email: localProfile.email,
          });
          setEditing(true);
        }
      } else {
        setEditing(true);
      }
    };

    loadProfile();
  }, []);

  const selectedItems = useMemo(
    () => items.filter((it) => selected[it.id]),
    [items, selected]
  );

 const total = useMemo(
  () =>
    selectedItems.reduce(
      (sum, it) => sum + (it.meta?.total_with_delivery ?? it.price * it.qty),
      0
    ),
  [selectedItems]
);

const selectedCount = selectedItems.length;

  function toggleSelectAll(checked: boolean) {
    setSelected(Object.fromEntries(items.map((it) => [it.id, checked])));
  }

  function updateQty(id: string, d: number) {
    const next = items.map((it) =>
      it.id === id ? { ...it, qty: Math.max(1, it.qty + d) } : it
    );
    setItems(next);
    localStorage.setItem("cart", JSON.stringify(next));
    window.dispatchEvent(new Event("cartUpdated")); // update layout badge
  }

  function removeItem(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    localStorage.setItem("cart", JSON.stringify(next));

    const { [id]: _, ...rest } = selected;
    setSelected(rest);

    window.dispatchEvent(new Event("cartUpdated")); // update layout badge
  }

  // Save profile with allowed fields only
  async function saveProfile() {
    const { id, name, phone, address, email } = profile;

    if (!name || !phone || !address || !email) {
      alert("Please fill all fields");
      return;
    }

    try {
      if (id) {
        const updates = { name, phone, address };
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: newProfile, error } = await supabase
          .from("profiles")
          .insert([{ name, phone, address, email }])
          .select("id")
          .single();
        if (error) throw error;
        setProfile((prev) => ({ ...prev, id: newProfile.id }));
      }

      localStorage.setItem("profile", JSON.stringify({ name, phone, address, email }));
      setEditing(false);
      alert("Profile saved successfully!");
    } 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to save profile");
    }
  }

  async function submitOrder() {
    const { id, name, phone, address, email } = profile;

    if (!name || !phone || !address || !email) {
      alert("Please complete your profile details first.");
      setEditing(true);
      return;
    }
    if (selectedItems.length === 0) return;

    setSubmitting(true);
    try {
      let profileId = id;
      if (!profileId) {
        const { data: newProfile, error } = await supabase
          .from("profiles")
          .insert([{ name, phone, address, email }])
          .select("id")
          .single();
        if (error) throw error;
        profileId = newProfile.id;
        setProfile((prev) => ({ ...prev, id: profileId }));
      }

      const { error: orderError } = await supabase.from("orders").insert([
        {
          profile_id: profileId,
          items: selectedItems.map(it => ({
            id: it.id,
            category: (it as any).category || null,       // ✅ include category
            subcategory: (it as any).subcategory || null, // ✅ include subcategory
            title: it.title,
            image: it.image,
            qty: it.qty,
            price: it.price,
            size: it.size,
            color: it.color,
            note: it.note,
            meta: it.meta ?? null,
          })),
          subtotal: selectedItems.reduce((s, it) => s + (it.meta?.subtotal ?? it.price * it.qty), 0),
          delivery_charge: selectedItems.reduce((s, it) => s + (it.meta?.delivery_charge ?? 0), 0),
          total, // ✅ already includes delivery
          status: "pending",
        },
      ]);

      if (orderError) throw orderError;

      // Keep remaining items in cart
      const remaining = items.filter((it) => !selected[it.id]);
      setItems(remaining);
      localStorage.setItem("cart", JSON.stringify(remaining));
      setSelected(Object.fromEntries(remaining.map((it) => [it.id, false])));
      window.dispatchEvent(new Event("cartUpdated")); // update layout badge

      localStorage.setItem("profile", JSON.stringify({ name, phone, address, email }));
      location.href = "/profile";
    } 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (e: any) {
      console.error(e);
      alert(e.message || "Error submitting order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-28 p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">🛒 Your Cart</h1>

     {/* Address / Profile Section */}
      <div className="bg-white shadow rounded-xl p-4 mb-4 border">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-800">Delivery Details</h2>
          {profile?.email && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {/* If not logged in */}
        {!profile?.email ? (
          <div className="text-center text-gray-600 text-sm py-6">
            ⚠️ You are not logged in. Please login first to place an order.
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Full Name"
              value={profile.name || ""}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Phone"
              value={profile.phone || ""}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Address"
              value={profile.address || ""}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, address: e.target.value }))
              }
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
              placeholder="Email"
              value={profile.email || ""}
              readOnly // 🔒 email cannot be changed
            />

            <div className="flex gap-3">
              <button
                onClick={saveProfile}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
              >
                Save
              </button>

              <button
                onClick={() => {
                  const lastSaved = JSON.parse(localStorage.getItem("profile") || "{}");
                  setProfile(lastSaved);
                  setEditing(false);
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-700 space-y-1">
            <div><span className="font-medium">Name:</span> {profile.name}</div>
            <div><span className="font-medium">Phone:</span> {profile.phone}</div>
            <div><span className="font-medium">Address:</span> {profile.address}</div>
            <div><span className="font-medium">Email:</span> {profile.email}</div>
          </div>
        )}
      </div>

      {/* Select all */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl shadow border">
          <input
            type="checkbox"
            checked={selectedCount === items.length && items.length > 0}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            className="w-5 h-5 accent-blue-600"
          />
          <span className="font-medium text-gray-700">
            Select All ({selectedCount}/{items.length})
          </span>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-gray-500 text-center mt-10 text-lg">
          Your cart is empty.
        </div>
      )}

      {/* Cart Items */}
      <div className="space-y-4">
        {items.map((it) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl shadow-md p-4 bg-white border border-gray-200 flex gap-4 items-start hover:shadow-lg transition"
          >
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={!!selected[it.id]}
              onChange={(e) =>
                setSelected({ ...selected, [it.id]: e.target.checked })
              }
              className="w-5 h-5 mt-2 accent-blue-600"
            />

            {/* Product Image */}
            {it.image && (
              <img
                src={it.image}
                alt={it.title}
                className="w-24 h-24 object-cover rounded-lg border"
              />
            )}

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base text-gray-800 truncate">
                {it.title}
              </div>
              {it.code && <div className="text-xs text-gray-500">{it.code}</div>}
              {it.size && <div className="text-xs text-gray-700">Size: {it.size}</div>}
              {it.color && <div className="text-xs text-gray-700">Color: {it.color}</div>}
              {it.note && (
                <div className="text-xs italic text-gray-600">Note: {it.note}</div>
              )}

              {/* Coupon Info */}
              {it.meta?.coupon && (
                <div className="mt-1 text-xs text-green-700">
                  Coupon applied:{" "}
                  <span className="font-medium">{it.meta.coupon}</span> (-
                  {it.meta.discount_pct}%)
                </div>
              )}

              {/* Price */}
              <div className="mt-2 flex items-center gap-2">
                {it.meta?.coupon ? (
                  <>
                    <span className="line-through text-gray-500 text-sm">
                      Rs {it.meta.original_price}
                    </span>
                    <span className="text-base font-bold text-blue-600">
                      Rs {it.price}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-blue-600">
                    Rs {it.price}
                  </span>
                )}
                <span className="text-sm text-gray-600">× {it.qty}</span>
              </div>

              {/* Totals (Safe fallbacks) */}
              {it.meta && (
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>
                      Rs{" "}
                      {((it.meta.subtotal ??
                        it.price * it.qty) as number).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span>
                      Rs {(it.meta.delivery_charge ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>
                      Rs{" "}
                      {((it.meta.total_with_delivery ??
                        it.price * it.qty) as number).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Quantity Controls */}
              <div className="mt-3 inline-flex items-center border rounded-lg overflow-hidden">
                {it.qty > 1 ? (
                  <button
                    onClick={() => updateQty(it.id, -1)}
                    className="px-3 py-1 text-gray-700 hover:bg-gray-100"
                  >
                    -
                  </button>
                ) : (
                  <button
                    onClick={() => removeItem(it.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <span className="px-4 py-1 text-gray-800 font-medium">
                  {it.qty}
                </span>

                <button
                  onClick={() => updateQty(it.id, +1)}
                  className="px-3 py-1 text-gray-700 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>


      {/* Sticky Checkout Bar */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 pb-20 left-0 right-0 bg-white shadow-lg p-3 border-t flex justify-between items-center"
          >
            <div className="text-base font-semibold">
              Total ({selectedCount} items):{" "}
              <span className="text-blue-600 font-bold">Rs {total}</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={ submitting || selectedCount === 0 || !profile?.email /* 🔒 block checkout if not logged in */ }
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow hover:scale-105 transition disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Place Order"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
