import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, authResponse } from "@/server/auth.mjs";
// Protect the deployed admin portal; individual API routes check their own credentials.
export function proxy(request: NextRequest) {
  return adminAuth(request) ? NextResponse.next() : authResponse();
}
export const config = { matcher: ["/", "/hackathon/:path*", "/documentation/:path*"] };
