import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

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
export async function assertDesk(): Promise<void> {
  if (!(await deskUnlocked())) {
    throw new Response("Unauthorized", { status: 401 });
  }
}
