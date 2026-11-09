import type { LocalDateTime } from "@/lib/dates";

export type MessageKind = "confirm" | "remind" | "scene";
export type MessageChannel = "alimtalk" | "friendtalk" | "email";
/** queued: 보낼 차례를 기다림(카카오 연결 전에는 여기서 멈춰요) */
export type MessageState = "queued" | "sent" | "failed" | "canceled";

export type PlannedMessage = {
  kind: MessageKind;
  channel: MessageChannel;
  state: MessageState;
  scheduledAt: LocalDateTime;
  sentAt?: LocalDateTime;
};

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  confirm: "예약 확정",
  remind: "하루 전",
  scene: "장면이 걸렸어요",
};

export const MESSAGE_KIND_WHEN: Record<MessageKind, string> = {
  confirm: "확정하는 순간",
  remind: "전날 18:00",
  scene: "SCENES 게시 때",
};

export const CHANNEL_LABEL: Record<MessageChannel, string> = {
  alimtalk: "알림톡",
  friendtalk: "친구톡",
  email: "이메일",
};

export const MESSAGE_STATE_LABEL: Record<MessageState, string> = {
  queued: "보낼 차례",
  sent: "보냄",
  failed: "실패",
  canceled: "안 보냄",
};
