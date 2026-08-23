import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ISSUER = "wealthlens-backend";
const AUDIENCE = "wealthlens-ai-service";

export function signAdvisorToolJwt({
  userId,
  ttlSeconds,
}: {
  userId: string;
  ttlSeconds: number;
}): string {
  return jwt.sign({ sub: userId }, env.ADVISOR_TOOL_SECRET, {
    algorithm: "HS256",
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: ttlSeconds,
  });
}

export function verifyAdvisorToolJwt(token: string): { userId: string } {
  const decoded = jwt.verify(token, env.ADVISOR_TOOL_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as jwt.JwtPayload;
  if (typeof decoded.sub !== "string") throw new Error("advisor tool jwt missing sub claim");
  return { userId: decoded.sub };
}
