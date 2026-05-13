// Data privacy / GDPR endpoints — stubbed.
function notImplemented(name: string): never {
  throw new Error(`${name} is not yet available on this environment.`);
}

export async function softDeleteUser(): Promise<never> {
  return notImplemented("softDeleteUser");
}
export async function exportUserData(): Promise<never> {
  return notImplemented("exportUserData");
}
export async function restoreUser(_data: { userId: string }): Promise<never> {
  return notImplemented("restoreUser");
}
export async function permanentlyDeleteUser(_data: { userId: string }): Promise<never> {
  return notImplemented("permanentlyDeleteUser");
}
export async function archiveOldData(_data: { daysOld?: number } = {}): Promise<never> {
  return notImplemented("archiveOldData");
}
