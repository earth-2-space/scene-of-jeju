"use client";

import { PageTop } from "@/components/admin/page-top";
import { shortDateTime } from "@/lib/dates";
import { renderMessage } from "@/lib/messages/templates";
import {
  CHANNEL_LABEL,
  MESSAGE_KIND_LABEL,
  MESSAGE_KIND_WHEN,
  MESSAGE_STATE_LABEL,
  type MessageKind,
} from "@/lib/messages/types";
import { NO_ADD_ONS } from "@/lib/rituals";
import { useReservations } from "@/lib/reservations/store";
import type { Reservation } from "@/lib/reservations/types";

const KINDS: MessageKind[] = ["confirm", "remind", "scene"];

// 문구 미리보기용 예시(브리프 8장의 예와 같게)
const EXAMPLE: Reservation = {
  id: "example",
  date: "2026-11-01",
  time: "10:00",
  ritualId: "plant-flower",
  privateClass: false,
  people: 2,
  addOns: NO_ADD_ONS,
  pickup: "onsite",
  lang: "ko",
  status: "confirmed",
  reviewed: true,
  source: "naver",
  customer: { name: "○○" },
  memo: "",
  messages: [],
  createdAt: "",
  updatedAt: "",
};

/**
 * 카카오 안내 세 가지와 발송 대기열.
 * 채널·템플릿 심사가 끝나기 전이라 켜고 끄기 대신 "연결 전" 상태로 보여줘요.
 */
export function MessagesOverview() {
  const reservations = useReservations();

  const log = (reservations ?? [])
    .flatMap((r) => r.messages.map((m) => ({ m, r })))
    .filter(({ m }) => m.state !== "canceled")
    .sort((a, b) => b.m.scheduledAt.localeCompare(a.m.scheduledAt));

  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
      <PageTop title="안내 발송" caption="카카오 채널 연결 전 · 문구와 흐름을 먼저 맞춰요" />

      <section className="grid gap-4 md:grid-cols-3">
        {KINDS.map((kind) => (
          <article key={kind} className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <h2 className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-[15px] font-semibold">{MESSAGE_KIND_LABEL[kind]}</span>
              <span className="hint">{MESSAGE_KIND_WHEN[kind]}</span>
            </h2>
            <p className="rounded-lg bg-sheet px-3 py-2 text-[13px] leading-relaxed">
              {renderMessage(kind, EXAMPLE)}
            </p>
            <p className="hint mt-auto">
              {kind === "scene" ? "친구톡(채널 친구)" : "알림톡 · 외국인은 이메일"} · 템플릿 심사 전
            </p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">보낸 내역</h2>
          <span className="hint">보낼 차례인 안내도 함께 보여요</span>
        </div>
        {reservations === null ? null : log.length === 0 ? (
          <p className="hint border-y border-line py-4">아직 안내가 없어요.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-line bg-sheet text-left text-[12px] text-ink-3">
                <th className="px-3 py-2 font-normal">시각</th>
                <th className="font-normal">안내</th>
                <th className="font-normal">받는 이</th>
                <th className="hidden font-normal sm:table-cell">채널</th>
                <th className="px-3 text-right font-normal">결과</th>
              </tr>
            </thead>
            <tbody>
              {log.map(({ m, r }) => (
                <tr key={`${r.id}-${m.kind}-${m.scheduledAt}`} className="border-t border-line-2">
                  <td className="px-3 py-2.5 text-ink-2">{shortDateTime(m.sentAt ?? m.scheduledAt)}</td>
                  <td>{MESSAGE_KIND_LABEL[m.kind]}</td>
                  <td>{r.customer.name}</td>
                  <td className="hidden text-ink-2 sm:table-cell">{CHANNEL_LABEL[m.channel]}</td>
                  <td className={`px-3 text-right ${m.state === "queued" ? "font-semibold text-jjok" : "text-ink-2"}`}>
                    {MESSAGE_STATE_LABEL[m.state]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
