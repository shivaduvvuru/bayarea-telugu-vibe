import { useSession } from "@tanstack/react-start/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type DeskSession = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env["DESK_SESSION_SECRET"];
  if (!password) throw new Error("Desk session secret is not configured");
  return {
    password,
    name: "desk-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function deskTokenSecret(): string {
  const secret = process.env["DESK_SESSION_SECRET"];
  if (!secret) throw new Error("Desk session secret is not configured");
  return secret;
}

function tokenSignature(payload: string): string {
  return createHmac("sha256", deskTokenSecret()).update(payload).digest("base64url");
}

/** Signed capability used when a preview proxy delays or drops the session cookie. */
export function createDeskToken(): string {
  const expires = Date.now() + 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${tokenSignature(payload)}`;
}

export function verifyDeskToken(token?: string): boolean {
  if (!token) return false;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied || Number(payload) <= Date.now()) return false;
  const expected = tokenSignature(payload);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function unlockDeskSession(passcode: string): Promise<boolean> {
  const expected = process.env["DESK_PASSCODE"];
  if (!expected) throw new Error("Desk passcode is not configured");
  if (!passwordMatches(passcode, expected)) return false;
  const session = await useSession<DeskSession>(sessionConfig());
  await session.update({ unlocked: true });
  return true;
}

export async function checkDeskSession(): Promise<boolean> {
  const session = await useSession<DeskSession>(sessionConfig());
  return Boolean(session.data.unlocked);
}

export async function lockDeskSession(): Promise<void> {
  const session = await useSession<DeskSession>(sessionConfig());
  await session.clear();
}

/** True only when the caller holds an unlocked editorial-desk session cookie. */
export async function deskUnlocked(): Promise<boolean> {
  try {
    const session = await useSession<DeskSession>(sessionConfig());
    return Boolean(session.data.unlocked);
  } catch {
    return false;
  }
}

/** Throws for anyone without an unlocked desk session. */
export async function assertDesk(token?: string): Promise<void> {
  if (!verifyDeskToken(token) && !(await deskUnlocked())) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
