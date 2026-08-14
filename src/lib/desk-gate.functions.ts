import { createServerFn } from "@tanstack/react-start";

export const unlockDesk = createServerFn({ method: "POST" })
  .validator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { unlockDeskSession } = await import("@/lib/desk-session.server");
    return { ok: await unlockDeskSession(data.passcode) };
  });

export const checkDesk = createServerFn({ method: "GET" }).handler(async () => {
  const { checkDeskSession } = await import("@/lib/desk-session.server");
  return { unlocked: await checkDeskSession() };
});

export const lockDesk = createServerFn({ method: "POST" }).handler(async () => {
  const { lockDeskSession } = await import("@/lib/desk-session.server");
  await lockDeskSession();
  return { ok: true as const };
});
