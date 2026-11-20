/*
 * 네이버 톡톡 챗봇 API(https://github.com/navertalk/chatbot-api) 이벤트 중 문의함에 쓰는 것만.
 * 자동 응답(챗봇)은 하지 않아요. 받아서 기록하고, 대표님이 어드민에서 답장해요.
 */

export type TalkContent = {
  textContent?: { text?: string; code?: string; inputType?: string };
  imageContent?: { imageUrl?: string };
  compositeContent?: unknown;
};

export type TalkEvent = TalkContent & {
  event: string;
  user?: string;
  partner?: string;
  echoedEvent?: string;
  options?: Record<string, unknown>;
};

export type TalkSender = "customer" | "admin" | "partner_center";
export type TalkKind = "text" | "image" | "composite" | "other";

export type TalkThread = {
  userId: string;
  inflow?: string;
  referer?: string;
  lastText?: string;
  lastAt?: string;
  unread: number;
  leftAt?: string;
  memo: string;
};

export type TalkMessage = {
  id: string;
  userId: string;
  direction: "in" | "out";
  sender: TalkSender;
  kind: TalkKind;
  text?: string;
  imageUrl?: string;
  createdAt: string;
};

export const TALK_SENDER_LABEL: Record<TalkSender, string> = {
  customer: "손님",
  admin: "어드민",
  partner_center: "파트너센터",
};

/** 문의함이 안 읽음 수를 바꿨을 때 왼쪽 메뉴 뱃지에 알리는 창 이벤트 */
export const TALK_UNREAD_EVENT = "soj:talk-unread";

/** 톡톡이 정한 글자 수 한도 */
export const TALK_TEXT_MAX = 10_000;

export function isTalkEvent(v: unknown): v is TalkEvent {
  return !!v && typeof v === "object" && typeof (v as { event?: unknown }).event === "string";
}

/** 메시지 내용 → 종류·글자·이미지. 목록 미리보기 글자도 같이 만들어요. */
export function readContent(e: TalkContent): { kind: TalkKind; text?: string; imageUrl?: string; preview: string } {
  if (e.textContent) {
    const text = e.textContent.text ?? "";
    // 안심번호 상담 요청은 "050…,2026-11-21" 모양으로 와요.
    if (e.textContent.inputType === "vphone") {
      const [num, until] = text.split(",");
      const shown = `안심번호로 상담 요청: ${num}${until ? ` (${until}까지)` : ""}`;
      return { kind: "text", text: shown, preview: shown };
    }
    return { kind: "text", text, preview: text };
  }
  if (e.imageContent) return { kind: "image", imageUrl: e.imageContent.imageUrl, preview: "(사진)" };
  if (e.compositeContent) return { kind: "composite", preview: "(카드 메시지)" };
  return { kind: "other", preview: "(메시지)" };
}
