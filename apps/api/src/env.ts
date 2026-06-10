import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  publicApiUrl: process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`
};

export function assertRuntimeEnv() {
  const missing = [];
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (!env.adminPasswordHash) missing.push("ADMIN_PASSWORD_HASH");
  if (missing.length) {
    console.warn(`Missing env values: ${missing.join(", ")}. Admin login will not work until configured.`);
  }
}
