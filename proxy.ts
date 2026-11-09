import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_HOME, SESSION_COOKIE } from "@/lib/auth";

// 쿠키가 있는지만 보는 낙관적 확인이에요. 실제 권한 검사는 Supabase 연결 때 서버 쪽에 둬요.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
