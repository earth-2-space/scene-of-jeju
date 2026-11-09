"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { dotMonthDay, shortDateTime } from "@/lib/dates";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/messages/types";
import { reservationStore } from "@/lib/reservations/store";
import { needsReview, type Reservation } from "@/lib/reservations/types";
import { RitualLabel } from "./marks";

export function BoardAside({
  reservations,
  today,
  onSelect,
}: {
  reservations: Reservation[];
  today: string;
  onSelect: (id: string) => void;
}) {
  const toConfirm = reservations
    .filter((r) => r.date >= today && needsReview(r))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const outbox = reservations
    .flatMap((r) => r.messages.filter((m) => m.state === "queued").map((m) => ({ m, r })))
    .sort((a, b) => a.m.scheduledAt.localeCompare(b.m.scheduledAt));

  return (
    <aside className="flex flex-col gap-4">
      <Panel title="확인할 예약" count={toConfirm.length}>
        {toConfirm.length === 0 ? (
          <p className="hint">모두 확인했어요.</p>
        ) : (
          <ul className="-mx-1">
            {toConfirm.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-sheet">
                <button type="button" onClick={() => onSelect(r.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium">
                    {r.customer.name}
                    <span className="ml-1 font-normal text-ink-3">
                      {r.status === "inquiry" ? "문의" : r.status === "pending" ? "대기" : "네이버 새 예약"}
                    </span>
                  </span>
                  <span className="flex gap-1.5 text-[12px] text-ink-3">
                    {dotMonthDay(r.date)} {r.time}
                    <RitualLabel r={r} withName={false} />
                  </span>
                </button>
                {r.status === "confirmed" ? (
                  <button
                    type="button"
                    className="btn btn-jjok px-2.5 py-1 text-[12px]"
                    onClick={() => reservationStore.review(r.id)}
                  >
                    확인
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-jjok px-2.5 py-1 text-[12px]"
                    onClick={() => reservationStore.setStatus(r.id, "confirmed")}
                  >
                    확정
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="보낼 안내" count={outbox.length}>
        {outbox.length === 0 ? (
          <p className="hint">보낼 안내가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {outbox.slice(0, 5).map(({ m, r }) => (
              <li key={`${r.id}-${m.kind}`} className="flex gap-2 text-[13px]">
                <span className="w-[76px] shrink-0 text-ink-3">{shortDateTime(m.scheduledAt)}</span>
                <span className="min-w-0 truncate">
                  {MESSAGE_KIND_LABEL[m.kind]} · {r.customer.name}
                  <span className="ml-1 text-[12px] text-ink-3">{CHANNEL_LABEL[m.channel]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint mt-3 border-t border-line-2 pt-3">
          카카오 채널 연결 전이라 실제로 나가지는 않아요.{" "}
          <Link href="/admin/messages" className="text-jjok hover:underline">
            전체 보기
          </Link>
        </p>
      </Panel>

      <button
        type="button"
        className="hint self-start hover:text-ink"
        onClick={() => {
          if (confirm("지금 화면의 예약을 지우고 예시 데이터로 되돌릴까요?")) reservationStore.resetToSample();
        }}
      >
        예시 데이터로 되돌리기
      </button>
    </aside>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line px-4 pt-3.5 pb-4">
      <h2 className="mb-2.5 flex items-baseline gap-1.5 text-[14px] font-semibold">
        {title}
        <span className="text-[13px] font-normal text-ink-3">{count}</span>
      </h2>
      {children}
    </section>
  );
}
