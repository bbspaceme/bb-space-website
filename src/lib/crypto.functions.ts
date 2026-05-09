/**
 * Cryptographic utilities for password & recovery code hashing
 * Uses Web Crypto API (built-in, works in Cloudflare Workers)
 */

/**
 * Generate a random salt for hashing
 */
function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a recovery code using PBKDF2 with SHA-256
 * Returns: "salt$hash" format for easy storage and verification
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const salt = generateSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${salt}$${hash}`;
}

/**
 * Verify a recovery code against a stored hash
 */
export async function verifyRecoveryCode(code: string, storedHash: string): Promise<boolean> {
  const [salt] = storedHash.split("$");
  if (!salt) return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(salt + code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const computedHash = `${salt}$${hash}`;
  return computedHash === storedHash;
}
