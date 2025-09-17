"use server";

import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export async function ensureProfile(userId: string, email: string) {
  // just use the client, do NOT call it
  const admin = supabaseAdmin;

  // Check if profile already exists
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  // If not, insert new row
  if (!data) {
    await admin.from("profiles").insert({ id: userId, email });
  }
}
