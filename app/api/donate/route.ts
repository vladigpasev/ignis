import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function env(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.length ? v : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const amount = Math.round(Number(body?.amount || 0));
    const currency = String(body?.currency || "bgn").toLowerCase();
    if (!amount || amount < 2) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const secret = env("STRIPE_SECRET_KEY");
    if (!secret) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const originHeader = req.headers.get("origin");
    const baseUrl = originHeader || env("NEXT_PUBLIC_APP_BASE_URL", "http://localhost:3000");

    const unitAmount = amount * 100; // smallest currency unit
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${baseUrl}/?donated=1`);
    params.set("cancel_url", `${baseUrl}/?donated=0`);
    params.set("payment_method_types[0]", "card");
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", currency);
    params.set("line_items[0][price_data][product_data][name]", "Дарение за Firelinks");
    params.set("line_items[0][price_data][unit_amount]", String(unitAmount));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      // Stripe requires TLS; Next.js fetch handles this normally
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || res.statusText || "Stripe error";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ url: data?.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

