"use client";

import { useState } from "react";
import { PageTop } from "@/components/admin/page-top";
import {
  addDays,
  diffDays,
  dotMonthDay,
  koMonthDay,
  koWeekday,
  relativeDayLabel,
  startOfWeek,
} from "@/lib/dates";
import { reservationStore, useReservationStore } from "@/lib/reservations/store";
import { needsReview, type Reservation } from "@/lib/reservations/types";
import { useToday } from "@/lib/use-today";
import { AddReservationSheet } from "./add-sheet";
import { BoardAside } from "./board-aside";
import { ReservationDetailSheet } from "./detail-sheet";
import { FlowStrip } from "./flow-strip";
import { NaverImportSheet } from "./import-sheet";
import { MailSyncNote } from "./mail-sync-note";
import {
  MessageDots,
  NewBadge,
  RitualLabel,
  SourceLabel,
  StatusChip,
  formatWonShort,
  optionSummary,
} from "./marks";

const isActive = (r: Reservation) => r.status !== "canceled" && r.status !== "inquiry";

// 표 칸 너비: 넓은 화면에선 한 줄에 다 보이고, 좁은 화면에선 시간·예약자·상태만 남겨요.
const COLS =
  "grid grid-cols-[52px_1fr_auto] items-center gap-x-3 md:grid-cols-[56px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_64px_96px_28px]";

export function ReservationBoard() {
  const today = useToday();
  const { reservations, error } = useReservationStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  if (!today || !reservations) {
    return <div className="px-4 py-8 text-[13px] text-ink-3 sm:px-8">예약을 불러오는 중…</div>;
  }

  const weekStart = addDays(startOfWeek(today), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map(
    weekDays.map((d) => [
      d,
      reservations.filter((r) => r.date === d).sort((a, b) => a.time.localeCompare(b.time)),
    ]),
  );
  const shownDays = weekDays.filter((d) => d === today || byDay.get(d)!.length > 0);
  const todayCount = reservations.filter((r) => r.date === today && isActive(r)).length;
  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
      <PageTop
        title="예약"
        caption={`${koMonthDay(today)} ${koWeekday(today)}요일 · 오늘 ${todayCount}팀`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>
              네이버 엑셀 올리기
            </button>
            <button type="button" className="btn btn-fill" onClick={() => setAddOpen(true)}>
              + 예약 추가
            </button>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-lg bg-jjok-soft px-4 py-2.5 text-[13px] text-jjok">
          <span className="mr-auto">{error}</span>
          <button type="button" className="underline" onClick={() => reservationStore.refresh()}>
            다시 불러오기
          </button>
        </div>
      )}
      <FlowStrip reservations={reservations} today={today} />
      <MailSyncNote />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
        <section aria-label="날짜별 예약" className="min-w-0 rounded-lg border border-line">
          <WeekNav
            weekDays={weekDays}
            today={today}
            counts={weekDays.map((d) => byDay.get(d)!.filter(isActive).length)}
            weekOffset={weekOffset}
            onWeek={setWeekOffset}
          />

          <div className={`${COLS} hidden border-b border-line bg-sheet px-4 py-2 text-[12px] text-ink-3 md:grid`}>
            <span>시간</span>
            <span>예약자</span>
            <span>리추얼</span>
            <span>네이버 결제</span>
            <span>들어온 곳</span>
            <span>상태</span>
            <span className="sr-only">안내</span>
          </div>

          {shownDays.length === 0 ? (
            <div className="px-4 py-10 text-center text-[14px] text-ink-2">
              이 주엔 아직 예약이 없어요.
            </div>
          ) : (
            shownDays.map((day) => (
              <DayGroup key={day} day={day} today={today} items={byDay.get(day)!} onSelect={setSelectedId} />
            ))
          )}
        </section>

        <BoardAside reservations={reservations} today={today} onSelect={setSelectedId} />
      </div>

      <ReservationDetailSheet reservation={selected} today={today} onClose={() => setSelectedId(null)} />
      <AddReservationSheet
        open={addOpen}
        defaultDate={today}
        onClose={() => setAddOpen(false)}
        onAdded={(r) => {
          setWeekOffset(diffDays(startOfWeek(r.date), startOfWeek(today)) / 7);
          setSelectedId(r.id);
        }}
      />
      <NaverImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </main>
  );
}

function WeekNav({
  weekDays,
  today,
  counts,
  weekOffset,
  onWeek,
}: {
  weekDays: string[];
  today: string;
  counts: number[];
  weekOffset: number;
  onWeek: (n: number) => void;
}) {
  return (
    <div className="border-b border-line px-4 pt-3 pb-2">
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <span className="font-semibold">
          {dotMonthDay(weekDays[0])} – {dotMonthDay(weekDays[6])}
        </span>
        <span className="ml-auto flex gap-1">
          <button type="button" className="btn px-2 py-1 text-[12px]" onClick={() => onWeek(weekOffset - 1)} aria-label="지난 주">
            ←
          </button>
          <button type="button" className="btn px-2.5 py-1 text-[12px]" disabled={weekOffset === 0} onClick={() => onWeek(0)}>
            이번 주
          </button>
          <button type="button" className="btn px-2 py-1 text-[12px]" onClick={() => onWeek(weekOffset + 1)} aria-label="다음 주">
            →
          </button>
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => {
          const isToday = d === today;
          const past = d < today;
          return (
            <li key={d}>
              <a
                href={counts[i] > 0 || isToday ? `#day-${d}` : undefined}
                className={`flex flex-col items-center rounded-md py-1.5 text-[11px] ${
                  isToday ? "bg-ink text-paper" : past ? "text-ink-3" : "text-ink-2 hover:bg-sheet"
                }`}
              >
                <span>{koWeekday(d)}</span>
                <span className="text-[15px] leading-tight font-semibold">{Number(d.slice(8))}</span>
                <span className={`h-4 ${isToday ? "text-paper/80" : "text-ink-3"}`}>
                  {counts[i] > 0 ? `${counts[i]}팀` : ""}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DayGroup({
  day,
  today,
  items,
  onSelect,
}: {
  day: string;
  today: string;
  items: Reservation[];
  onSelect: (id: string) => void;
}) {
  const rel = relativeDayLabel(day, today);

  return (
    <div id={`day-${day}`} className="scroll-mt-28">
      <div className="flex items-baseline gap-2 border-b border-line-2 px-4 pt-4 pb-2">
        <span className="text-[14px] font-semibold">
          {koMonthDay(day)} ({koWeekday(day)})
        </span>
        {rel && (
          <span className={`text-[12px] ${rel === "오늘" ? "font-semibold text-jjok" : "text-ink-3"}`}>{rel}</span>
        )}
        <span className="hint ml-auto">{items.filter(isActive).length}팀</span>
      </div>
      {items.length === 0 ? (
        <p className="border-b border-line-2 px-4 py-4 text-[13px] text-ink-3">오늘은 예약이 없어요.</p>
      ) : (
        <ul>
          {items.map((r) => (
            <li key={r.id} className="border-b border-line-2 last:border-b-0">
              <Row r={r} onSelect={() => onSelect(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ r, onSelect }: { r: Reservation; onSelect: () => void }) {
  const extras = [...optionSummary(r), r.naver?.request && "요청사항 있음"].filter(Boolean);
  const faded = r.status === "canceled" || r.status === "no_show";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${COLS} w-full px-4 py-3 text-left text-[14px] hover:bg-sheet ${faded ? "opacity-55" : ""}`}
    >
      <span className="font-semibold">{r.time}</span>

      <span className="min-w-0">
        <span className="block truncate font-medium">
          {r.customer.name}
          <span className="ml-1.5 font-normal text-ink-3">{r.people}명</span>
        </span>
        <span className="block truncate text-[12px] text-ink-3 md:hidden">
          <RitualLabel r={r} withName={false} /> · <SourceLabel r={r} />
          {extras.length > 0 && ` · ${extras.join(" · ")}`}
        </span>
        {extras.length > 0 && (
          <span className="hidden truncate text-[12px] text-ink-3 md:block">{extras.join(" · ")}</span>
        )}
      </span>

      <span className="hidden text-[13px] md:block">
        <RitualLabel r={r} />
      </span>

      <span className="hidden text-[13px] md:block">
        {r.naver ? (
          <>
            {formatWonShort(r.naver.payment.amount)}
            <span className="block text-[12px] text-ink-3">네이버페이 · 아이템 현장</span>
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </span>

      <span className="hidden md:block">
        <SourceLabel r={r} />
      </span>

      <span className="justify-self-end md:justify-self-start">
        {/* 이용완료·취소처럼 끝난 예약은 엑셀로 처음 들어와도 상태로 보여줘요 */}
        {r.reviewed || faded || !needsReview(r) ? <StatusChip status={r.status} /> : <NewBadge />}
      </span>

      <span className="hidden md:inline-flex">
        <MessageDots messages={r.messages} />
      </span>
    </button>
  );
}
