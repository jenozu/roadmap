import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const PRIVATE_SESSION_COOKIE = "voyages_private_session";
const SESSION_SECONDS = 12 * 60 * 60;
const VERSION = "v1";

type Environment = Record<string, string | undefined>;

function configuredSecret(env: Environment = process.env): string | undefined {
  const value = env.VOYAGES_PRIVATE_ACCESS_SECRET?.trim();
  return value && value.length >= 24 ? value : undefined;
}

function signature(secret: string, expires: string): string {
  return createHmac("sha256", secret).update(VERSION + "." + expires).digest("base64url");
}

function equalText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function privateSessionConfigured(env: Environment = process.env): boolean {
  return Boolean(configuredSecret(env));
}

export function verifyPrivateAccessSecret(candidate: string, env: Environment = process.env): boolean {
  const secret = configuredSecret(env);
  if (!secret || !candidate) return false;
  return equalText(candidate, secret);
}

export function createPrivateSessionValue(now = Date.now(), env: Environment = process.env): string | undefined {
  const secret = configuredSecret(env);
  if (!secret) return undefined;
  const expires = String(Math.floor(now / 1000) + SESSION_SECONDS);
  return expires + "." + signature(secret, expires);
}

export function verifyPrivateSessionValue(
  value: string | undefined,
  now = Date.now(),
  env: Environment = process.env
): boolean {
  const secret = configuredSecret(env);
  if (!secret || !value) return false;
  const [expires, supplied, extra] = value.split(".");
  if (!expires || !supplied || extra) return false;
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(now / 1000)) return false;
  return equalText(supplied, signature(secret, expires));
}

export function requestHasPrivateSession(request: NextRequest, env: Environment = process.env): boolean {
  return verifyPrivateSessionValue(request.cookies.get(PRIVATE_SESSION_COOKIE)?.value, Date.now(), env);
}

export function privateSessionMaxAge(): number {
  return SESSION_SECONDS;
}
