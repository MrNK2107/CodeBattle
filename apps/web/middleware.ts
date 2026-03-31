import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export default auth((req) => {
  const isAuthenticated = Boolean(req.auth);
  const protectedRoutes = req.nextUrl.pathname.startsWith("/app") || req.nextUrl.pathname.startsWith("/admin");

  if (!isAuthenticated && protectedRoutes) {
    const callbackUrl = req.nextUrl.pathname + req.nextUrl.search;
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.nextUrl.origin),
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
