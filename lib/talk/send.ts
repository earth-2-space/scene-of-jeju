import "server-only";

/*
 * 톡톡 보내기 API. 인증 키는 파트너센터 > 개발자도구 > 챗봇API 설정 > 보내기 API에서 만들어요.
 * 응답은 HTTP 200이어도 success:false일 수 있어서 resultCode까지 봐요.
 */

const ENDPOINT = "https://gw.talk.naver.com/chatbot/v1/event";

const RESULT_HINT: Record<string, string> = {
  "01": "보내기 API 인증 키(NAVER_TALK_AUTH)가 틀렸거나 재설정됐어요",
  "02": "보낸 내용 형식이 맞지 않아요",
};

export async function sendTalkText(user: string, text: string): Promise<void> {
  const auth = process.env.NAVER_TALK_AUTH;
  if (!auth) throw new Error("NAVER_TALK_AUTH 환경변수(보내기 API 인증 키)를 먼저 넣어 주세요.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8", Authorization: auth },
    body: JSON.stringify({ event: "send", user, textContent: { text } }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; resultCode?: string; resultMessage?: string }
    | null;
  if (!res.ok || !body?.success) {
    const code = body?.resultCode ?? String(res.status);
    throw new Error(`톡톡으로 보내지 못했어요: ${RESULT_HINT[code] ?? body?.resultMessage ?? code}`);
  }
}
