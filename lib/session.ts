import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const key = new TextEncoder().encode(process.env.SESSION_SECRET!);

export type SessionPayload = JWTPayload & {
  userId: string;
  steamId: string;
};

export async function createSession(payload: {
  userId: string;
  steamId: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
