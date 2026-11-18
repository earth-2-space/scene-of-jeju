import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ingestMails } from "@/lib/db/naver-mails";
import type { NaverMail } from "@/lib/naver-mail/parse";

/*
 * POST: Gmail(Apps Script)이 5분마다 새 네이버 예약 메일을 보내요. 헤더 x-soj-secret으로 확인해요.
 * 읽은 예약은 바로 Supabase 예약 DB에 합쳐요. 어드민 화면은 서버 액션으로 예약과 못 읽은 메일을 다시 읽어요.
 */

const MAX_MAILS = 50;
const MAX_BODY = 2_000_000;

function secretMatches(given: string | null) {
  const expected = process.env.NAVER_MAIL_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isMail(v: unknown): v is NaverMail {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.subject === "string" &&
    (m.text === undefined || typeof m.text === "string") &&
    (m.html === undefined || typeof m.html === "string")
  );
}

export async function POST(request: NextRequest) {
  if (!process.env.NAVER_MAIL_SECRET) {
    return Response.json({ error: "NAVER_MAIL_SECRET 환경변수를 먼저 설정해 주세요." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-soj-secret"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY) return Response.json({ error: "too large" }, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const mails = (payload as { mails?: unknown })?.mails;
  if (!Array.isArray(mails) || mails.length > MAX_MAILS || !mails.every(isMail)) {
    return Response.json({ error: `mails: 메일 배열(최대 ${MAX_MAILS}개)이 필요해요` }, { status: 400 });
  }

  return Response.json(await ingestMails(mails));
}
