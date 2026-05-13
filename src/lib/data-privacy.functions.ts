// Data privacy / GDPR endpoints — stubbed.
// The underlying RPCs (soft_delete_user, restore_user, permanently_delete_user,
// archive_old_data) and the auth.users projection are not yet deployed.
// Replace with real implementations once the migrations land.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function notImplemented(name: string): never {
  throw new Error(`${name} is not yet available on this environment.`);
}

export const softDeleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async () => notImplemented("softDeleteUser"));

export const exportUserData = createServerFn({ method: "GET" })
  .inputValidator(z.object({}))
  .handler(async () => notImplemented("exportUserData"));

export const restoreUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async () => notImplemented("restoreUser"));

export const permanentlyDeleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async () => notImplemented("permanentlyDeleteUser"));

export const archiveOldData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ daysOld: z.number().min(30).max(3650).optional() }))
  .handler(async () => notImplemented("archiveOldData"));
