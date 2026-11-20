import { needsReview, type Reservation } from "@/lib/reservations/types";

/**
 * 1차 개발 흐름을 숫자 세 개로 보여줘요(11/6 회의).
 * 네이버 예약이 들어오고 → 어드민에서 확인·확정하면 → 카카오 안내가 나가요.
 */
export function FlowStrip({ reservations, today }: { reservations: Reservation[]; today: string }) {
  const upcoming = reservations.filter((r) => r.date >= today);
  const naverNew = upcoming.filter((r) => r.source === "naver" && !r.reviewed && r.status === "confirmed").length;
  const toConfirm = upcoming.filter(needsReview).length;
  const queued = reservations.flatMap((r) => r.messages).filter((m) => m.state === "queued").length;

  const steps = [
    { label: "네이버 새 예약", value: naverNew, note: "바로확정 · 메일·엑셀로 들어와요" },
    { label: "확인할 예약", value: toConfirm, note: "확인하면 카카오 안내가 잡혀요", strong: true },
    { label: "보낼 카카오 안내", value: queued, note: "채널 연결 전이라 대기 중" },
  ];

  return (
    <ol aria-label="예약 흐름" className="grid grid-cols-3 gap-2">
      {steps.map((s, i) => (
        <li key={s.label} className="relative rounded-lg border border-line px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="text-[12px] leading-snug text-ink-2 sm:text-[13px]">
            <span className="mr-1.5 hidden text-ink-3 sm:inline">{i + 1}</span>
            {s.label}
          </div>
          <div className={`mt-0.5 text-[24px] leading-tight font-semibold ${s.strong && s.value > 0 ? "text-jjok" : ""}`}>
            {s.value}
            <span className="ml-0.5 text-[13px] font-normal text-ink-3">건</span>
          </div>
          <div className="hint hidden sm:block">{s.note}</div>
          {i < steps.length - 1 && (
            <span aria-hidden className="absolute top-1/2 -right-2 z-1 hidden -translate-y-1/2 bg-paper text-[13px] text-ink-3 sm:block">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
