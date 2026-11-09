import type { LocalDateTime } from "@/lib/dates";

/*
 * 네이버 예약에서 넘어오는 원본 정보.
 * 기준: 씬오브제주 네이버 예약 페이지 캡처(2026.11.09) — 상품 → 회차 → 추가 옵션 → 결제 순서.
 * 정식 API 대신 예약 알림 메일(Gmail 자동 전달)이나 엑셀로 받아요.
 * 예약자 정보(이름·연락처·요청사항) 단계는 캡처에 없어서, 메일 샘플을 받으면 맞춰요.
 */

export type NaverStatus = "confirmed" | "completed" | "canceled" | "no_show";

export const NAVER_STATUS_LABEL: Record<NaverStatus, string> = {
  confirmed: "확정(바로확정)",
  completed: "이용완료",
  canceled: "취소",
  no_show: "노쇼",
};

export type NaverOptionGroup = "추가 프로그램" | "수령 옵션" | "언어";

export type NaverBooking = {
  /** 예약번호: 메일·엑셀을 다시 받을 때 같은 예약인지 가르는 키 */
  bookingId: string;
  status: NaverStatus;
  /** 상품명 원문. 예: "블루 리추얼 (타이다이)", "씬오브유 리추얼 (나만의 풍경 물들이기)" */
  productName: string;
  /** 회차: 날짜·시작 시간(이용 시간 2시간) */
  slot: LocalDateTime;
  /** 신청 시각 */
  bookedAt?: LocalDateTime;
  /** 인원(수량) */
  people: number;
  /** 추가 옵션 탭 세 개에서 고른 것 */
  options: { group: NaverOptionGroup; name: string; count: number; price: number }[];
  payment: {
    /** 네이버페이로 결제한 금액(할인가 기준) */
    amount: number;
    /** 할인 전 금액 */
    listAmount?: number;
  };
  request?: string;
  canceledAt?: LocalDateTime;
};

/** 네이버 예약 화면에서 확인한 항목과, 메일 샘플로 더 확인할 항목 */
export const NAVER_FIELD_GUIDE: { label: string; note: string; confirmed: boolean }[] = [
  { label: "상품", note: "리추얼 4종 + 씬오브유(개인)", confirmed: true },
  { label: "회차", note: "날짜·시작 시간, 이용 2시간", confirmed: true },
  { label: "인원", note: "만 5세 이상", confirmed: true },
  { label: "추가 프로그램", note: "추가작업 · 풍경한입 · 보물찾기", confirmed: true },
  { label: "수령 옵션", note: "현장픽업 · 방문픽업 · 택배발송", confirmed: true },
  { label: "안내 언어", note: "한국어 · English · 日本語 · 中文", confirmed: true },
  { label: "결제 금액", note: "네이버페이, 할인가 기준", confirmed: true },
  { label: "예약 상태", note: "바로확정 · 취소 · 이용완료", confirmed: true },
  { label: "예약번호", note: "같은 예약을 묶는 키", confirmed: false },
  { label: "예약자 이름·연락처", note: "카카오 안내를 보낼 번호", confirmed: false },
  { label: "요청사항", note: "예약자가 적은 메모", confirmed: false },
];
