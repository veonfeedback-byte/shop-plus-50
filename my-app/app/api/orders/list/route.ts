// app/api/orders/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const secret = req.headers.get('x-client-secret') || '';

  if (!clientId || !secret) {
    return NextResponse.json({ error: 'Missing clientId or secret' }, { status: 400 });
  }

  // Verify profile
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id, client_secret')
    .eq('client_id', clientId)
    .maybeSingle();
  if (pErr || !profile || profile.client_secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Fetch orders
  const { data: orders, error: oErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false });
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });

  return NextResponse.json({ orders });
}
