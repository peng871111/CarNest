import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  { prefix: "/dashboard" },
  { prefix: "/seller/vehicles", roles: ["seller", "buyer"] },
  { prefix: "/seller", roles: ["seller"] },
  { prefix: "/admin", roles: ["admin", "super_admin"] }
];

const adminPermissionRoutes = [
  { prefix: "/admin/users", permission: "manageAdmins" },
  { prefix: "/admin/vehicles", permission: "manageVehicles" },
  { prefix: "/admin/offers", permission: "manageOffers" },
  { prefix: "/admin/enquiries", permission: "manageEnquiries" },
  { prefix: "/admin/inspections", permission: "manageInspections" },
  { prefix: "/admin/pricing", permission: "managePricing" },
  { prefix: "/admin/quotes", permission: "manageQuotes" }
];

function getRoleHome(role?: string) {
  if (role === "admin" || role === "super_admin") return "/admin/vehicles";
  if (role === "seller") return "/seller/vehicles";
  return "/seller/vehicles";
}

function parsePermissions(value?: string) {
  if (!value) return {} as Record<string, boolean>;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, Boolean(entry)]));
  } catch {
    return {} as Record<string, boolean>;
  }
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get("carnest_session")?.value;
  const role = request.cookies.get("carnest_role")?.value;
  const permissions = parsePermissions(request.cookies.get("carnest_permissions")?.value);

  const match = protectedRoutes.find((route) => request.nextUrl.pathname.startsWith(route.prefix));
  if (!match) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (match.roles && !match.roles.includes(role ?? "")) {
    return NextResponse.redirect(new URL(getRoleHome(role), request.url));
  }

  if (request.nextUrl.pathname.startsWith("/admin") && role !== "super_admin") {
    const permissionRoute = adminPermissionRoutes.find((route) => request.nextUrl.pathname.startsWith(route.prefix));
    if (permissionRoute && !permissions[permissionRoute.permission]) {
      return NextResponse.redirect(new URL(getRoleHome(role), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/seller/:path*", "/admin/:path*"]
};
