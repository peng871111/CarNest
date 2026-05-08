import { NextRequest, NextResponse } from "next/server";

const CANONICAL_ORIGIN = "https://carnest.au";
const CANONICAL_REDIRECT_HOSTS = new Set([
  "www.carnest.au",
  "carnest-alpha.vercel.app",
  "carnest-8b52f.firebaseapp.com"
]);

const protectedRoutes = [
  { prefix: "/dashboard" },
  { prefix: "/dealer", roles: ["dealer"] },
  { prefix: "/seller/vehicles", roles: ["seller", "buyer", "dealer"] },
  { prefix: "/seller", roles: ["seller", "dealer"] },
  { prefix: "/admin", roles: ["admin", "super_admin"] }
];

const adminPermissionRoutes = [
  { prefix: "/admin/users", permission: "manageAdmins" },
  { prefix: "/admin/compliance", permission: "manageUsers" },
  { prefix: "/admin/dealer-applications", permission: "manageUsers" },
  { prefix: "/admin/vehicles", permission: "manageVehicles" },
  { prefix: "/admin/offers", permission: "manageOffers" },
  { prefix: "/admin/enquiries", permission: "manageEnquiries" },
  { prefix: "/admin/inspections", permission: "manageInspections" },
  { prefix: "/admin/pricing", permission: "managePricing" },
  { prefix: "/admin/quotes", permission: "manageQuotes" }
];

function getRoleHome(role?: string, dealerStatus?: string) {
  if (role === "admin" || role === "super_admin") return "/admin/vehicles";
  if (role === "dealer") return dealerStatus === "approved" ? "/dealer/dashboard" : "/dealer/application-status";
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

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1";
}

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();

  if (!isLocalDevelopmentHost(hostname) && CANONICAL_REDIRECT_HOSTS.has(hostname)) {
    const canonicalUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, CANONICAL_ORIGIN);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const session = request.cookies.get("carnest_session")?.value;
  const role = request.cookies.get("carnest_role")?.value;
  const dealerStatus = request.cookies.get("carnest_dealer_status")?.value;
  const permissions = parsePermissions(request.cookies.get("carnest_permissions")?.value);
  const pathname = request.nextUrl.pathname;

  const match = protectedRoutes.find((route) => pathname.startsWith(route.prefix));
  if (!match) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (
    (pathname.startsWith("/dealer") || pathname.startsWith("/seller"))
    && role === "dealer"
    && dealerStatus !== "approved"
    && !pathname.startsWith("/dealer/apply")
    && !pathname.startsWith("/dealer/application-status")
  ) {
    return NextResponse.redirect(new URL("/dealer/application-status", request.url));
  }

  if (match.roles && !match.roles.includes(role ?? "") && !(pathname.startsWith("/dealer") && dealerStatus === "approved")) {
    return NextResponse.redirect(new URL(getRoleHome(role, dealerStatus), request.url));
  }

  if (pathname.startsWith("/admin") && role !== "super_admin") {
    const permissionRoute = adminPermissionRoutes.find((route) => pathname.startsWith(route.prefix));
    if (permissionRoute && !permissions[permissionRoute.permission]) {
      return NextResponse.redirect(new URL(getRoleHome(role, dealerStatus), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
