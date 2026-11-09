import { fromISODate } from "@/lib/dates";
import { ADD_ONS, PRIVATE_CLASS, RITUAL_FAMILIES, formatWon, getRitual, slotOf } from "@/lib/rituals";
import type { Reservation } from "@/lib/reservations/types";
import type { MessageKind } from "./types";

// 발송 문구 초안(브리프 8장). 대표님이 최종 교정하고, 카카오 템플릿 심사본과 맞춰요.
export function renderMessage(kind: MessageKind, r: Reservation): string {
  const name = r.customer.name;
  const ritual = getRitual(r.ritualId);
  const what = r.privateClass
    ? PRIVATE_CLASS.label + " 리추얼"
    : ritual
      ? RITUAL_FAMILIES[ritual.family].full
      : "리추얼";
  const d = fromISODate(r.date);
  const hour = Number(r.time.slice(0, 2));
  const minute = r.time.slice(3);
  const at = minute === "00" ? `${hour}시` : `${hour}시 ${Number(minute)}분`;

  switch (kind) {
    case "confirm": {
      const pickup =
        r.pickup === "delivery"
          ? " 택배 받으실 주소는 현장에서 알려 주세요."
          : r.pickup === "visit"
            ? " 방문픽업은 다음날부터 7일 안에 오시면 돼요."
            : "";
      return `${name}님, ${d.getMonth() + 1}월 ${d.getDate()}일 ${slotOf(r.time)} ${what} 예약이 확정됐어요. 아이템은 현장에서 보고 고르시면 돼요.${pickup}`;
    }
    case "remind":
      return r.addOns.landscapeBite > 0
        ? `내일 ${at}에 뵈어요. ${ADD_ONS.landscapeBite.label}도 준비해 둘게요.`
        : `내일 ${at}에 뵈어요. ${ADD_ONS.landscapeBite.label}도 함께 하시면 ${formatWon(ADD_ONS.landscapeBite.price!)}이에요.`;
    case "scene":
      return `${name}님의 장면 「○○○」가 SCENES에 걸렸어요.`;
  }
}
