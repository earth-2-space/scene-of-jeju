// 리추얼·옵션·가격은 바뀔 수 있어서 화면에 박지 않고 여기 데이터로 둬요.
// 기준: 네이버 예약 페이지(2026.11.09 캡처). Supabase 연결 후에는 ritual 테이블에서 읽어 와요.

export type RitualFamily = "plant" | "blue";

export const RITUAL_FAMILIES: Record<RitualFamily, { label: string; full: string }> = {
  plant: { label: "식물", full: "식물 리추얼" },
  blue: { label: "블루", full: "블루 리추얼" },
};

export type Ritual = { id: string; family: RitualFamily; name: string; detail: string };

export const RITUALS: Ritual[] = [
  { id: "plant-flower", family: "plant", name: "플라워", detail: "꽃염색" },
  { id: "plant-green", family: "plant", name: "그린", detail: "나뭇잎 염색" },
  { id: "blue-landscape", family: "blue", name: "푸른 풍경", detail: "" },
  { id: "blue-tiedye", family: "blue", name: "타이다이", detail: "" },
];

export function getRitual(id: string | null | undefined): Ritual | undefined {
  return RITUALS.find((r) => r.id === id);
}

/** "식물 리추얼 플라워" / 씬오브유처럼 리추얼을 현장에서 고르면 "리추얼 현장 선택" */
export function ritualText(id: string | null | undefined) {
  const r = getRitual(id);
  return r ? `${RITUAL_FAMILIES[r.family].full} ${r.name}` : "리추얼 현장 선택";
}

/** 가격(1인). 네이버에선 정가에서 할인한 금액으로 결제해요. 아이템값은 현장에서 따로 받아요. */
export const PRICE = {
  base: 70_000, // 자연 리추얼 기본 작업비용(정가)
  naver: 50_000, // 네이버 할인가(28%)
  privateClass: 500_000, // 씬오브유(개인 클래스), 예약 한 건 기준
  itemMin: 30_000, // 현장에서 고르는 아이템 추가금
  itemMax: 90_000,
};

/** 씬오브유: 이름만 다른 개인 클래스. 진행 코스는 같아요. */
export const PRIVATE_CLASS = { label: "씬오브유", full: "씬오브유 리추얼 (개인)" };

/** 추가 프로그램. 수량은 1인 기준이에요. */
export type AddOnId = "landscapeBite" | "extraWork" | "treasureHunt";
export const ADD_ONS: Record<AddOnId, { label: string; price: number | null; note: string }> = {
  landscapeBite: { label: "풍경한입", price: 14_000, note: "차와 디저트(정가 15,000원)" },
  extraWork: { label: "추가작업", price: null, note: "피염물 가격만 현장 결제" },
  treasureHunt: { label: "보물찾기", price: 0, note: "무료" },
};
export type AddOns = Record<AddOnId, number>;
export const NO_ADD_ONS: AddOns = { landscapeBite: 0, extraWork: 0, treasureHunt: 0 };

/** 수령 옵션. 방문픽업·택배발송은 1인 기준 요금이에요. */
export type Pickup = "onsite" | "visit" | "delivery";
export const PICKUP: Record<Pickup, { label: string; price: number; note: string }> = {
  onsite: { label: "현장픽업", price: 0, note: "젖은 상태로 비닐 포장" },
  visit: { label: "방문픽업", price: 10_000, note: "다음날부터 7일 안에 픽업" },
  delivery: { label: "택배발송", price: 15_000, note: "주소는 온라인 기재 또는 현장에서" },
};

/** 수업 안내 언어(영상·프레젠테이션) */
export type Lang = "ko" | "en" | "ja" | "zh";
export const LANG_LABEL: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

export function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 오전/오후는 회차 시간으로 정해요 */
export function slotOf(time: string) {
  return Number(time.slice(0, 2)) < 12 ? "오전" : "오후";
}
