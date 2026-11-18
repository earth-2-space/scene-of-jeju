import type { NaverStatus } from "@/lib/naver/types";

/*
 * 네이버 스마트플레이스 예약 엑셀 → 예약 필드 매칭표.
 * 기준: 스마트플레이스 "예약자관리" 엑셀(2026.11.18 내려받기, 4~9월 예약 14건).
 * 열 이름이 바뀌면 이 파일만 고치면 돼요. (앞에 있는 후보부터, 공백·대소문자 무시하고 찾아요)
 *
 * 실제 파일에서 확인한 것
 * - 위 두 줄은 안내 문구, 세 번째 줄이 열 이름이에요(열 이름 줄은 찾아서 읽어요).
 * - 예약자 이름(김*수)·전화번호(******1234)·이메일은 네이버가 가려서 내보내요. 카카오 안내 번호로는 못 써요.
 * - 옵션은 한 칸이 아니라 "옵션2-한국어", "가격분류8-식물산책 프로그램 참가비"처럼 항목마다 수량 칸이 따로 있어요.
 * 받는 항목은 lib/naver/types.ts의 NaverBooking과 같아요.
 */

export type NaverField =
  | "bookingId"
  | "name"
  | "phone"
  | "date"
  | "time"
  | "product"
  | "people"
  | "options"
  | "amount"
  | "status"
  | "bookedAt"
  | "request";

export const NAVER_FIELDS: {
  field: NaverField;
  label: string;
  required: boolean;
  candidates: string[];
}[] = [
  { field: "bookingId", label: "예약번호", required: true, candidates: ["예약번호", "예약 번호", "주문번호"] },
  { field: "name", label: "예약자", required: true, candidates: ["예약자명", "예약자", "이름", "고객명"] },
  { field: "phone", label: "연락처", required: false, candidates: ["전화번호", "연락처", "휴대폰번호", "예약자 연락처"] },
  { field: "date", label: "이용일", required: true, candidates: ["이용일", "이용일시", "예약일", "방문일", "날짜"] },
  { field: "time", label: "회차(시간)", required: false, candidates: ["이용시간", "회차", "시간", "방문시간", "예약시간"] },
  { field: "product", label: "상품명", required: true, candidates: ["상품명", "상품", "예약상품", "메뉴"] },
  { field: "people", label: "인원", required: false, candidates: ["인원", "인원수", "수량", "예약인원"] },
  { field: "options", label: "추가 옵션", required: false, candidates: ["옵션", "추가옵션", "선택옵션"] },
  { field: "amount", label: "결제금액", required: false, candidates: ["실결제금액", "결제금액", "결제 금액", "총금액", "금액"] },
  { field: "status", label: "예약상태", required: false, candidates: ["상태", "예약상태", "진행상태"] },
  { field: "bookedAt", label: "신청일시", required: false, candidates: ["예약신청일시", "신청일시", "신청일", "접수일시"] },
  { field: "request", label: "요청사항", required: false, candidates: ["요청사항", "요청 사항", "메모", "고객요청"] },
];

/** 네이버 상태 글자 → 네이버 상태. 씬오브제주 상품은 "바로확정"이라 신청도 확정으로 봐요. */
export const NAVER_STATUS_TEXT: Record<string, NaverStatus> = {
  신청: "confirmed",
  예약신청: "confirmed",
  확정: "confirmed",
  예약확정: "confirmed",
  바로확정: "confirmed",
  이용완료: "completed",
  취소: "canceled",
  예약취소: "canceled",
  노쇼: "no_show",
};

/**
 * 상품명 → 리추얼. 위에서부터 먼저 맞는 것.
 * 씬오브유는 개인 클래스라 가격만 다르고 코스는 같아요. 리추얼은 현장에서 정해요(null).
 * 올해 상품명이 여러 번 바뀌어서 옛 이름도 넣어 뒀어요(엑셀 2026.04~09 기준).
 * "포레스트 리츄얼(나뭇잎…+힐링세트(꽃차…" 처럼 꽃차가 들어간 식물 상품이 있어서 잎·숲을 꽃보다 먼저 봐요.
 */
export const NAVER_PRODUCT_RULES: { includes: string; ritualId: string | null; privateClass?: boolean }[] = [
  { includes: "씬오브유", ritualId: null, privateClass: true },
  { includes: "타이다이", ritualId: "blue-tiedye" },
  { includes: "푸른", ritualId: "blue-landscape" },
  { includes: "블루", ritualId: "blue-landscape" },
  { includes: "파란", ritualId: "blue-landscape" },
  { includes: "쪽", ritualId: "blue-landscape" },
  { includes: "포레스트", ritualId: "plant-green" },
  { includes: "forest", ritualId: "plant-green" },
  { includes: "나뭇잎", ritualId: "plant-green" },
  { includes: "그린", ritualId: "plant-green" },
  { includes: "플라워", ritualId: "plant-flower" },
  { includes: "꽃", ritualId: "plant-flower" },
  { includes: "잎", ritualId: "plant-green" },
];

/**
 * 항목마다 수량 칸이 따로 있는 엑셀("옵션2-한국어", "필수-규래차 업그레이드", "가격분류8-…참가비").
 * 열 이름에서 이 머리말을 떼고 이름만 남겨요. "… 결제금액" 칸은 금액이라 수량으로 안 읽어요.
 */
export const NAVER_COUNT_COLUMN = /^(옵션|필수|가격분류)\s*\d*\s*-\s*(?:\d+-)?\s*(?:\d+\.\s*)?(.+)$/;
/** "참가비"가 들어간 가격분류는 인원이에요. 없으면(옛 상품) 아이템 수·언어 수로 인원을 어림해요. */
export const NAVER_PEOPLE_WORD = "참가비";
/** 수량 칸이지만 옵션이 아닌 것(동의 체크) */
export const NAVER_IGNORE_OPTIONS = ["확인하였습니다"];

/**
 * 옵션 글자 → 추가 프로그램·수령·언어. 옵션 칸에 "풍경한입(2), 택배발송(1), English(2)"처럼
 * 이름과 수량이 함께 온다고 보고 읽어요. 샘플을 받으면 구분자·모양을 맞춰요.
 */
export const NAVER_OPTION_NAMES = {
  addOns: { 풍경한입: "landscapeBite", 추가작업: "extraWork", 보물찾기: "treasureHunt" },
  pickup: { 현장픽업: "onsite", 방문픽업: "visit", 택배발송: "delivery", 택배: "delivery" },
  lang: { 한국어: "ko", english: "en", 영어: "en", 日本語: "ja", 일본어: "ja", 中文: "zh", 중국어: "zh" },
} as const;
