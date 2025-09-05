// app/lib/auth.ts
import { supabase } from './supabaseClient';

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
}
