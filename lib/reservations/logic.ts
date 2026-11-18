import { planMessages } from "@/lib/messages/triggers";
import type { Reservation, ReservationStatus } from "./types";

/*
 * 예약 상태를 바꿀 때의 규칙. 서버(DB 저장)에서 써요.
 * 어드민에서 상태를 바꾸면 "확인한 것"으로 보고, 확인한 예약만 안내를 잡아요.
 */
export function withStatus(r: Reservation, status: ReservationStatus, now: string): Reservation {
  if (r.status === status && r.reviewed) return r;
  const reviewed = { ...r, reviewed: true };
  return { ...reviewed, status, messages: planMessages(reviewed, status, now), updatedAt: now };
}

/** 네이버에서 취소되면 대표님 확인과 상관없이 취소로 바꾸고 남은 안내를 멈춰요. */
export function cancelFromNaver(r: Reservation, now: string): Reservation {
  if (r.status === "canceled") return r;
  return { ...r, status: "canceled", messages: planMessages(r, "canceled", now), updatedAt: now };
}
