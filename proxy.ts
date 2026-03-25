import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const isLoginPage = req.nextUrl.pathname === "/admin/login"
  if (isLoginPage) return NextResponse.next()

  const session = await auth()
  const isLoggedIn = !!session

  if (!isLoggedIn) {
    const loginUrl = new URL("/admin/login", req.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ["/admin/:path*"],
}