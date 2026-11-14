import { createHash, scrypt } from "node:crypto";

export const protectedOwnerId = "f2cd3fe8-58b3-4dfa-9125-fd8f1bd35f8e";
export const protectedOwnerScope = Object.freeze({
  webPresenceId: "819d007a-595d-4374-a2f0-96b900d46559",
  managedSiteId: "1d92a248-416f-4e22-baaf-d2f1fca70352",
});
export const protectedOwnerUsername = "owner";
export const protectedOwnerSessionSeconds = 8 * 60 * 60;

// One distinct salt for this fixed principal and origin. The existing credential
// table stores a domain-separated verifier so this login cannot authenticate to WordPress delivery.
export function protectedOwnerToken(password: unknown): Promise<string> {
  if (typeof password !== "string" || password.length < 16 || Buffer.byteLength(password) > 512 ||
      /[\u0000-\u001f\u007f]/u.test(password) || !password.trim()) throw Error("Operator sign-in refused");
  return new Promise((resolve, reject) => {
    scrypt(password, "miopages/protected-core/owner/v1/" + protectedOwnerId, 32,
      { N: 32_768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 }, (error, key) => {
        if (error) reject(Error("Operator sign-in unavailable"));
        else {
          const token = key.toString("hex");
          key.fill(0);
          resolve(token);
        }
      });
  });
}

export function protectedOwnerVerifier(token: string) {
  return createHash("sha256").update("miopages/protected-core/owner/verifier/v1\0")
    .update(Buffer.from(token, "hex")).digest("hex");
}
