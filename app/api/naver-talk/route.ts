import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { recordTalkEvent } from "@/lib/db/talk";
import { isTalkEvent } from "@/lib/talk/types";

/*
 * 네이버 톡톡 챗봇 API webhook.
 * 파트너센터 > 개발자도구 > 챗봇API 설정 > "이벤트 받을 URL"에
 *   https://<어드민 주소>/api/naver-talk?key=<NAVER_TALK_WEBHOOK_KEY>
 * 를 넣어요. 톡톡은 서명을 보내지 않아서 주소에 붙인 비밀 값으로 확인해요.
 * 톡톡은 3초 안에 연결, 5초 안에 응답을 기다려요. 자동 답장은 하지 않고 200만 돌려줘요.
 */

const MAX_BODY = 200_000;

function keyMatches(given: string | null) {
  const expected = process.env.NAVER_TALK_WEBHOOK_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.NAVER_TALK_WEBHOOK_KEY) {
    return Response.json({ error: "NAVER_TALK_WEBHOOK_KEY 환경변수를 먼저 설정해 주세요." }, { status: 503 });
  }
  if (!keyMatches(request.nextUrl.searchParams.get("key"))) {
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
  if (!isTalkEvent(payload)) return Response.json({ error: "not a talk event" }, { status: 400 });

  try {
    await recordTalkEvent(payload);
  } catch (e) {
    // 200이 아니면 톡톡이 실패로 기록해요(다시 보내 주지는 않아요). 서버 로그에서 확인해요.
    console.error("[naver-talk]", payload.event, e);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
