// app/api/orders/cancel/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function POST(req: Request) {
  const body = await req.json();
  const { orderId, clientId } = body as { orderId: string; clientId: string };
  const secret = req.headers.get('x-client-secret') || '';

  if (!orderId || !clientId || !secret) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Verify ownership
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, client_secret')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!profile || profile.client_secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id,status,profile_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.profile_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
  }

  const { error: updErr } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled', expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString() })
    .eq('id', orderId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
