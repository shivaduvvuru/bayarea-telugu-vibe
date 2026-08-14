import { useSession } from "@tanstack/react-start/server";

const sessionConfig = {
  password: process.env["DESK_SESSION_SECRET"]!,
  name: "desk-gate",
  maxAge: 60 * 60 * 24 * 30,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

/** True only when the caller holds an unlocked editorial-desk session cookie. */
export async function deskUnlocked(): Promise<boolean> {
  try {
    const session = await useSession<{ unlocked?: boolean }>(sessionConfig);
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
