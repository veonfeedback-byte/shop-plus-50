// app/api/orders/create/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

type CartItem = {
  id: string;
  code?: string;
  title: string;
  image?: string;
  price: number;
  qty: number;
  note?: string | null;
  size?: string | null;
  color?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, phone, address, items, note, size, color } = body as {
      email: string; name: string; phone: string; address: string;
      items: CartItem[]; note?: string; size?: string | null; color?: string | null;
    };

    if (!email || !items?.length) {
      return NextResponse.json({ error: 'Email and items are required' }, { status: 400 });
    }

    // 1) Upsert profile by email
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let profile = existingProfile;
    if (!profile) {
      const { data: created, error: upErr } = await supabaseAdmin
        .from('profiles')
        .insert([{ email, name, phone, address }])
        .select()
        .single();
      if (upErr) throw upErr;
      profile = created;
    } else {
      // keep info fresh
      await supabaseAdmin
        .from('profiles')
        .update({ name, phone, address })
        .eq('id', profile.id);
    }

    // 2) Compute total
    const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);

    // 3) Create order
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .insert([{
        profile_id: profile.id,
        status: 'pending',
        items,
        note: note || null,
        size: size || null,
        color: color || null,
        total
      }])
      .select()
      .single();
    if (ordErr) throw ordErr;

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      clientId: profile.client_id,
      clientSecret: profile.client_secret
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}