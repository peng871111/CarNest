import { NextRequest, NextResponse } from "next/server";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ?? "";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    if (!TURNSTILE_SECRET_KEY) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const formData = new URLSearchParams();
    formData.set("secret", TURNSTILE_SECRET_KEY);
    formData.set("response", token);

    const remoteIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    if (remoteIp) {
      formData.set("remoteip", remoteIp);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString(),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ success: false }, { status: 502 });
    }

    const result = (await response.json()) as { success?: boolean };
    return NextResponse.json({ success: Boolean(result.success) });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
