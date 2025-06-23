import { NextRequest, NextResponse } from "next/server";
import { PrivyClient, AuthTokenClaims } from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  throw new Error("Missing required Privy environment variables");
}

const client = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

export type AuthenticateSuccessResponse = {
  claims: AuthTokenClaims;
};

export type AuthenticationErrorResponse = {
  error: string;
};

export async function POST(req: NextRequest) {
  try {
    const headerAuthToken = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const cookieAuthToken = req.cookies.get("privy-token")?.value;
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 }
      );
    }

    const claims = await client.verifyAuthToken(authToken);
    
    return NextResponse.json(
      { claims } as AuthenticateSuccessResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Auth token verification failed:", error);
    return NextResponse.json(
      { error: error.message || "Invalid auth token" } as AuthenticationErrorResponse,
      { status: 401 }
    );
  }
}
