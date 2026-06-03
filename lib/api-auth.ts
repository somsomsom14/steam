import { cookies } from "next/headers";
import { verifySession, type SessionPayload } from "@/lib/session";

export async function requireSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifySession(token);
}
