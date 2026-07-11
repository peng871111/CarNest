import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAdminCalendarReminder } from "@/lib/admin-calendar-reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getProvidedCronSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-cron-secret")?.trim() ?? "";
}

function secretsMatch(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (!expectedBuffer.length || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function hasValidCronAccess(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!expectedSecret) {
    console.error("[admin-calendar-reminder] Missing CRON_SECRET.");
    return false;
  }

  const providedSecret = getProvidedCronSecret(request);
  if (!providedSecret) {
    console.warn("[admin-calendar-reminder] Request missing cron secret.", {
      userAgent: request.headers.get("user-agent") ?? "",
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
      hasCronSecretHeader: Boolean(request.headers.get("x-cron-secret"))
    });
    return false;
  }
  return secretsMatch(expectedSecret, providedSecret);
}

async function handleReminderRequest(request: NextRequest) {
  if (!hasValidCronAccess(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  console.info("[admin-calendar-reminder] Trigger received.", {
    force,
    userAgent: request.headers.get("user-agent") ?? ""
  });
  const result = await runAdminCalendarReminder({ force });
  console.info("[admin-calendar-reminder] Trigger completed.", result);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  return await handleReminderRequest(request);
}

export async function POST(request: NextRequest) {
  return await handleReminderRequest(request);
}
