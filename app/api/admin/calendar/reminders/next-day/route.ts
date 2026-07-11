import { NextRequest, NextResponse } from "next/server";
import { hasAdminApiAccess } from "@/lib/admin-api-auth";
import {
  getAdminCalendarReminderDiagnostics,
  runAdminCalendarReminder
} from "@/lib/admin-calendar-reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!hasAdminApiAccess(request, "manageVehicles")) {
    return unauthorized();
  }

  try {
    const diagnostics = await getAdminCalendarReminderDiagnostics();
    return NextResponse.json({ success: true, diagnostics });
  } catch (error) {
    console.error("[admin-calendar-reminder-manual] Diagnostics failed.", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load reminder diagnostics."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasAdminApiAccess(request, "manageVehicles")) {
    return unauthorized();
  }

  try {
    const result = await runAdminCalendarReminder({ force: true });
    const diagnostics = await getAdminCalendarReminderDiagnostics();
    return NextResponse.json({
      success: true,
      result,
      diagnostics
    });
  } catch (error) {
    console.error("[admin-calendar-reminder-manual] Manual reminder send failed.", error);
    const diagnostics = await getAdminCalendarReminderDiagnostics().catch(() => null);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to send the reminder email.",
        diagnostics
      },
      { status: 500 }
    );
  }
}
