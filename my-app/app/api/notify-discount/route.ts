import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const data = await req.json();
  console.log("Notify discount called:", data);

  // You can do something with this data, e.g., send an email or log it
  return NextResponse.json({ ok: true });
}
