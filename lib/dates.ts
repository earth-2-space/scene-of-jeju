// 날짜는 "YYYY-MM-DD"(제주 현지) 문자열로 다뤄요. 시간대 계산을 피하려고 Date는 로컬로만 써요.
export type ISODate = string;

const KO_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000);
}

/** 그 주의 월요일 */
export function startOfWeek(s: ISODate): ISODate {
  const day = fromISODate(s).getDay();
  return addDays(s, day === 0 ? -6 : 1 - day);
}

export function koWeekday(s: ISODate) {
  return KO_WEEKDAYS[fromISODate(s).getDay()];
}

export function enWeekday(s: ISODate) {
  return EN_WEEKDAYS[fromISODate(s).getDay()];
}

/** "Nov. 9" */
export function enMonthDay(s: ISODate) {
  const d = fromISODate(s);
  return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "11.09" */
export function dotMonthDay(s: ISODate) {
  const d = fromISODate(s);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** "11월 9일" */
export function koMonthDay(s: ISODate) {
  const d = fromISODate(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 오늘을 기준으로 붙이는 이름: 오늘 / 내일 / 어제 */
export function relativeDayLabel(s: ISODate, today: ISODate): string | null {
  const diff = diffDays(s, today);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  return null;
}

/** "2026-11-10T18:00" 같은 로컬 시각 문자열 */
export type LocalDateTime = string;

export function localDateTime(date: ISODate, time: string): LocalDateTime {
  return `${date}T${time}`;
}

export function nowLocal(now = new Date()): LocalDateTime {
  return `${toISODate(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** "11.10 18:00" */
export function shortDateTime(dt: LocalDateTime) {
  const [date, time] = dt.split("T");
  return `${dotMonthDay(date)} ${time}`;
}
