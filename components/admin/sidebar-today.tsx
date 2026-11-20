"use client";

import { addDays, koMonthDay, koWeekday } from "@/lib/dates";
import { useReservations } from "@/lib/reservations/store";
import { useToday } from "@/lib/use-today";

export function SidebarToday() {
  const today = useToday();
  const reservations = useReservations();
  if (!today || !reservations) return <div className="h-10" aria-hidden />;

  const teams = (date: string) =>
    reservations.filter(
      (r) => r.date === date && r.status !== "canceled" && r.status !== "inquiry",
    ).length;

  return (
    <div className="text-[13px] leading-relaxed text-ink-2">
      <b className="block text-[13px] font-semibold text-ink">
        {koMonthDay(today)} ({koWeekday(today)})
      </b>
      오늘 {teams(today)}팀 · 내일 {teams(addDays(today, 1))}팀
    </div>
  );
}
