import { verifyToken } from "@clerk/backend";

export type AuthContext = {
  userId: string;
};

// Clerk has no official Expo Router (`+api.ts`) integration (see
// clerk-expo skill), so `+api.ts` routes verify the bearer token by hand
// instead of using a framework adapter's `getAuth(request)`. The client
// side sends `Authorization: Bearer ${await getToken()}` (see
// `(customer)/onboarding/profile.tsx`).
export async function getAuthContext(request: Request): Promise<AuthContext | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing CLERK_SECRET_KEY — add it to your .env file (Clerk Dashboard → API keys).",
    );
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    return { userId: payload.sub };
  } catch (err) {
    console.error("Clerk token verification failed:", err);
    return null;
  }
}
