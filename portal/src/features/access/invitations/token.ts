import { createHash, randomBytes } from "node:crypto";

export type InvitationToken = Readonly<{
  rawToken: string;
  tokenHash: string;
}>;

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function buildInvitationToken(): InvitationToken {
  const rawToken = randomBytes(32).toString("base64url");

  return {
    rawToken,
    tokenHash: hashInvitationToken(rawToken),
  };
}
