import { addDays, localDateTime, type LocalDateTime } from "@/lib/dates";
import type { Reservation, ReservationStatus } from "@/lib/reservations/types";
import type { MessageChannel, PlannedMessage } from "./types";

export const REMIND_TIME = "18:00";

function channelFor(r: Reservation): MessageChannel {
  // 전화번호가 있으면 알림톡(네이버 예약은 늘 있어요), 없으면 이메일(영문 폼 외국인 손님).
  return r.customer.phone ? "alimtalk" : "email";
}

/**
 * 예약 상태가 바뀔 때 안내 발송 계획을 다시 짜요.
 * 1차 개발의 핵심 트리거: "확정" 순간 확정 안내, 전날 18시 리마인드.
 * 실제 발송은 카카오 채널 연결 후 이 대기열을 읽는 작업(크론)이 맡아요.
 */
export function planMessages(
  r: Reservation,
  next: ReservationStatus,
  now: LocalDateTime,
): PlannedMessage[] {
  const messages = r.messages.map((m) => ({ ...m }));
  const has = (kind: PlannedMessage["kind"]) =>
    messages.some((m) => m.kind === kind && m.state !== "canceled");

  if (next === "confirmed") {
    if (!has("confirm")) {
      messages.push({ kind: "confirm", channel: channelFor(r), state: "queued", scheduledAt: now });
    }
    if (!has("remind")) {
      const remindAt = localDateTime(addDays(r.date, -1), REMIND_TIME);
      const visitAt = localDateTime(r.date, r.time);
      // 이미 전날 18시가 지났으면 리마인드는 건너뛰어요(확정 안내가 그 역할을 해요).
      if (remindAt > now && visitAt > now) {
        messages.push({ kind: "remind", channel: channelFor(r), state: "queued", scheduledAt: remindAt });
      }
    }
  }

  if (next === "canceled" || next === "no_show" || next === "pending" || next === "inquiry") {
    for (const m of messages) {
      if (m.state === "queued") m.state = "canceled";
    }
  }

  return messages;
}
