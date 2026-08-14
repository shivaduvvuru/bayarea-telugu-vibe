import { createServerFn } from "@tanstack/react-start";

export const unlockDesk = createServerFn({ method: "POST" })
  .validator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { createDeskToken, unlockDeskSession } = await import("@/lib/desk-session.server");
    const ok = await unlockDeskSession(data.passcode);
    return { ok, deskToken: ok ? createDeskToken() : null };
  });

export const checkDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { checkDeskSession, createDeskToken } = await import("@/lib/desk-session.server");
  const unlocked = await checkDeskSession();
  return { unlocked, deskToken: unlocked ? createDeskToken() : null };
});

export const lockDesk = createServerFn({ method: "POST" }).handler(async () => {
  const { lockDeskSession } = await import("@/lib/desk-session.server");
  await lockDeskSession();
  return { ok: true as const };
});
