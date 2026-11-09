import type { ISODate } from "@/lib/dates";
import type { PlannedMessage } from "@/lib/messages/types";
import type { NaverBooking } from "@/lib/naver/types";
import type { AddOns, Lang, Pickup } from "@/lib/rituals";

export type { Lang } from "@/lib/rituals";

// 상태 흐름(브리프 3장): 문의 → 대기 → 확정 → 방문, 확정에서 노쇼·취소로 갈라져요.
// 네이버는 "바로확정"이라 확정 상태로 들어와요.
export type ReservationStatus =
  | "inquiry"
  | "pending"
  | "confirmed"
  | "visited"
  | "no_show"
  | "canceled";

export const STATUS_ORDER: ReservationStatus[] = [
  "inquiry",
  "pending",
  "confirmed",
  "visited",
  "no_show",
  "canceled",
];

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  inquiry: "문의",
  pending: "대기",
  confirmed: "확정",
  visited: "방문",
  no_show: "노쇼",
  canceled: "취소",
};

export type ReservationSource = "naver" | "form" | "manual";

export type Customer = {
  name: string;
  /** 국내 고객 기준 키 */
  phone?: string;
  /** 외국인 고객 기준 키 */
  email?: string;
};

export type Reservation = {
  id: string;
  date: ISODate;
  time: string; // "HH:mm" 회차 시작
  /** 씬오브유(개인 클래스)는 리추얼을 현장에서 고르기도 해서 비어 있을 수 있어요 */
  ritualId: string | null;
  /** 씬오브유 개인 클래스 */
  privateClass: boolean;
  people: number;
  addOns: AddOns;
  pickup: Pickup;
  /** 수업 안내 언어(영상·워크북). 외국어면 안내도 이메일로 */
  lang: Lang;
  status: ReservationStatus;
  /**
   * 대표님이 확인했는지. 네이버 바로확정 예약은 확정 상태로 들어오지만,
   * 어드민에서 확인해야 카카오 안내가 잡혀요(11/6 회의 흐름).
   */
  reviewed: boolean;
  source: ReservationSource;
  /** 엑셀·메일을 다시 받았을 때 같은 예약인지 가르는 키 */
  naverBookingId?: string;
  /** 네이버에서 들어온 예약이면 원본 정보를 그대로 들고 있어요 */
  naver?: NaverBooking;
  customer: Customer;
  memo: string;
  /** 1차 데모에선 예약 안에 두고, DB에선 message 테이블로 나눠요 */
  messages: PlannedMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ReservationInput = Omit<
  Reservation,
  "id" | "messages" | "createdAt" | "updatedAt"
>;

/** 확인이 필요한 예약: 아직 안 본 네이버 예약, 대기, 문의 */
export function needsReview(r: Reservation) {
  if (r.status === "canceled" || r.status === "visited" || r.status === "no_show") return false;
  return !r.reviewed || r.status === "pending" || r.status === "inquiry";
}
