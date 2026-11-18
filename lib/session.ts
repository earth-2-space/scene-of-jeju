import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

/*
 * 어드민 세션: "만료시각.서명" 쿠키 하나. 서명은 ADMIN_SESSION_SECRET(없으면 ADMIN_PASSWORD)로 해요.
 * 예약 DB에 실제 고객 정보가 들어가니, 쿠키가 있기만 하면 통과하던 1차 방식에서 서명 확인으로 바꿨어요.
 * proxy.ts는 쿠키가 있는지만 보고 화면을 돌려 보내고, 데이터를 읽고 쓰는 곳은 모두 requireAdmin()을 거쳐요.
 */

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_SESSION_SECRET(또는 ADMIN_PASSWORD) 환경변수가 필요해요.");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionValue(now = Date.now()) {
  const exp = String(now + SESSION_MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
}

export function isValidSession(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !(Number(exp) > now)) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin() {
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export class UnauthorizedError extends Error {
  constructor() {
    super("다시 로그인해 주세요.");
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new UnauthorizedError();
}
