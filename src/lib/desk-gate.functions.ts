import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

const sessionConfig = {
  password: process.env['DESK_SESSION_SECRET']!,
  name: "desk-gate",
  maxAge: 60 * 60 * 24 * 30, // 30 days
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

type DeskSession = { unlocked?: boolean };

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const unlockDesk = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env['DESK_PASSCODE'];
    if (!expected) throw new Error("Desk passcode is not configured");

    if (!passwordMatches(data.passcode, expected)) {
      return { ok: false as const };
    }

    const session = await useSession<DeskSession>(sessionConfig);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const checkDesk = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<DeskSession>(sessionConfig);
  return { unlocked: Boolean(session.data.unlocked) };
});

export const lockDesk = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<DeskSession>(sessionConfig);
  await session.clear();
  return { ok: true as const };
});
