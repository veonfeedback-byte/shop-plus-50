"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

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
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    if (Array.isArray(stored)) {
      setItems(
        stored.map((it: any) => ({
          ...it,
          price: typeof it.price === "string" ? parseFloat(it.price) : it.price,
        }))
      );
    }

    const p = JSON.parse(localStorage.getItem("profile") || "{}");
    if (p.name) setName(p.name);
    if (p.phone) setPhone(p.phone);
    if (p.address) setAddress(p.address);
    if (p.email) setEmail(p.email);
    if (p.name || p.phone || p.address || p.email) setEditing(false);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0),
    [items]
  );

  function updateQty(id: string, d: number) {
    const next = items.map((it) =>
      it.id === id ? { ...it, qty: Math.max(1, it.qty + d) } : it
    );
    setItems(next);
    localStorage.setItem("cart", JSON.stringify(next));
  }

  function removeItem(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    localStorage.setItem("cart", JSON.stringify(next));
  }

  async function submitOrder() {
    if (!email) {
      alert("Please enter your email.");
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      // ensure profile exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      let userId: string;
      if (!existing) {
        const { data, error } = await supabase
          .from("profiles")
          .insert([{ name, phone, address, email }])
          .select("id")
          .single();
        if (error) throw error;
        userId = data.id;
      } else {
        userId = existing.id;
      }

      // insert order
      const { error: orderError } = await supabase.from("orders").insert([
        {
          user_id: userId,
          items,
          total,
          status: "pending",
        },
      ]);
      if (orderError) throw orderError;

      // save local profile
      localStorage.setItem(
        "profile",
        JSON.stringify({ name, phone, address, email })
      );
      localStorage.removeItem("cart");
      location.href = "/profile";
    } catch (e: any) {
      alert(e.message || "Error submitting order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Cart</h1>

      {items.length === 0 && <div>Your cart is empty.</div>}

      {items.map((it) => (
        <div key={it.id} className="rounded-xl shadow p-3 bg-white flex gap-3">
          {it.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.image}
              alt={it.title}
              className="w-20 h-20 object-cover rounded border"
            />
          )}
          <div className="flex-1">
            <div className="font-medium">{it.title}</div>
            {it.code && <div className="text-sm text-gray-500">{it.code}</div>}
            {it.size && <div className="text-sm text-gray-700">Size: {it.size}</div>}
            {it.color && <div className="text-sm text-gray-700">Color: {it.color}</div>}
            {it.note && <div className="text-sm italic">Note: {it.note}</div>}
            <div className="font-semibold mt-1">
              Rs {it.price} × {it.qty} = Rs {Number(it.price) * Number(it.qty)}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => updateQty(it.id, -1)} className="px-3 py-1 border rounded">-</button>
              <button onClick={() => updateQty(it.id, +1)} className="px-3 py-1 border rounded">+</button>
              <button onClick={() => removeItem(it.id)} className="px-3 py-1 border rounded">Remove</button>
            </div>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <div className="rounded-xl shadow p-4 bg-white space-y-3">
          <div className="text-lg font-semibold">Order details</div>
          <div className="grid md:grid-cols-4 gap-3">
            <label className="text-sm">Name<input className="w-full border rounded p-2" value={name} onChange={(e) => setName(e.target.value)} disabled={!editing}/></label>
            <label className="text-sm">Phone<input className="w-full border rounded p-2" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing}/></label>
            <label className="text-sm">Address<input className="w-full border rounded p-2" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!editing}/></label>
            <label className="text-sm">Email<input className="w-full border rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing}/></label>
          </div>
          <button className="px-3 py-1 border rounded" onClick={() => setEditing(!editing)}>✏️ Edit</button>
          <div className="text-sm">Payment: <b>Cash on Delivery (COD)</b></div>
          <div className="text-lg font-bold">Total: Rs {total}</div>
          <button onClick={submitOrder} disabled={submitting} className="px-4 py-2 rounded border">
            {submitting ? "Submitting…" : "Submit Order"}
          </button>
        </div>
      )}
    </div>
  );
}
