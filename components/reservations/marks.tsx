import { MESSAGE_KIND_LABEL, MESSAGE_STATE_LABEL, type MessageKind, type PlannedMessage } from "@/lib/messages/types";
import { ADD_ONS, LANG_LABEL, PICKUP, PRIVATE_CLASS, RITUAL_FAMILIES, getRitual, type AddOnId } from "@/lib/rituals";
import { STATUS_LABEL, type Reservation, type ReservationStatus } from "@/lib/reservations/types";

/** 리추얼: 색 점 하나 + 이름. 식물 = 이끼, 블루 = 쪽빛, 씬오브유(리추얼 현장 선택)는 먹 */
export function RitualLabel({ r, withName = true }: { r: Pick<Reservation, "ritualId" | "privateClass">; withName?: boolean }) {
  const ritual = getRitual(r.ritualId);
  const dot = ritual ? (ritual.family === "blue" ? "bg-jjok" : "bg-moss") : "bg-ink";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      {r.privateClass ? PRIVATE_CLASS.label : ritual ? RITUAL_FAMILIES[ritual.family].label : "리추얼"}
      {withName && (ritual || r.privateClass) && (
        <span className="text-ink-3">· {ritual ? ritual.name : "현장 선택"}</span>
      )}
    </span>
  );
}

/** 목록에 짧게: "풍경한입 2 · 택배발송 · English" (기본값인 현장픽업·한국어는 생략) */
export function optionSummary(r: Pick<Reservation, "addOns" | "pickup" | "lang">) {
  return [
    ...(Object.keys(r.addOns) as AddOnId[])
      .filter((id) => r.addOns[id] > 0)
      .map((id) => `${ADD_ONS[id].label} ${r.addOns[id]}`),
    r.pickup !== "onsite" && PICKUP[r.pickup].label,
    r.lang !== "ko" && LANG_LABEL[r.lang],
  ].filter(Boolean) as string[];
}

/** 아직 확인 안 한 네이버 예약 표시 */
export function NewBadge() {
  return (
    <span className="text-[14px] font-semibold whitespace-nowrap text-jjok">
      새 예약
    </span>
  );
}

const STATUS_STYLE: Record<ReservationStatus, string> = {
  inquiry: "text-ink-2",
  pending: "text-jjok font-semibold",
  confirmed: "text-ink",
  visited: "text-moss font-medium",
  no_show: "text-ink-3 line-through",
  canceled: "text-ink-3 line-through",
};

export function StatusChip({ status }: { status: ReservationStatus }) {
  return (
    <span className={`text-[14px] whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const SOURCE_TEXT: Record<Reservation["source"], string> = {
  naver: "네이버",
  form: "문의폼",
  manual: "직접",
};

/** 들어온 곳: 네이버는 초록 N 대신 글자로만, 담백하게 */
export function SourceLabel({ r }: { r: Reservation }) {
  return <span className="text-[13px] whitespace-nowrap text-ink-3">{SOURCE_TEXT[r.source]}</span>;
}

const DOT_KINDS: MessageKind[] = ["confirm", "remind", "scene"];

/** 안내 세 가지(확정·하루 전·장면이 걸렸어요)를 점 셋으로: 채움 = 보냄, 쪽빛 = 보낼 차례 */
export function MessageDots({ messages }: { messages: PlannedMessage[] }) {
  const label = DOT_KINDS.map((kind) => {
    const m = latest(messages, kind);
    return `${MESSAGE_KIND_LABEL[kind]} ${m ? MESSAGE_STATE_LABEL[m.state] : "아직"}`;
  }).join(", ");

  return (
    <span className="inline-flex gap-1" role="img" aria-label={label} title={label}>
      {DOT_KINDS.map((kind) => {
        const m = latest(messages, kind);
        const cls =
          m?.state === "sent" ? "bg-ink" : m?.state === "queued" ? "bg-jjok" : "bg-line";
        return <i key={kind} className={`size-1.5 rounded-full ${cls}`} />;
      })}
    </span>
  );
}

export function latest(messages: PlannedMessage[], kind: MessageKind) {
  return messages.filter((m) => m.kind === kind).at(-1);
}

export function formatWonShort(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}
