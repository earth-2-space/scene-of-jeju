import { addDays, localDateTime, nowLocal, toISODate } from "@/lib/dates";
import { REMIND_TIME } from "@/lib/messages/triggers";
import type { PlannedMessage } from "@/lib/messages/types";
import type { NaverBooking, NaverStatus } from "@/lib/naver/types";
import {
  ADD_ONS,
  LANG_LABEL,
  NO_ADD_ONS,
  PICKUP,
  PRICE,
  PRIVATE_CLASS,
  RITUAL_FAMILIES,
  getRitual,
  type AddOns,
} from "@/lib/rituals";
import { prepaidAmount } from "./price";
import type { Reservation, ReservationInput } from "./types";

// 시안용 예시 데이터. 실명 대신 마스킹한 이름을 쓰고, 날짜는 오늘을 기준으로 만들어요.
// 상품·옵션·가격은 네이버 예약 페이지(11/9 캡처) 기준이에요.
type SeedRow = Omit<ReservationInput, "date" | "memo" | "pickup" | "addOns" | "naver" | "lang" | "privateClass"> &
  Partial<Pick<ReservationInput, "memo" | "pickup" | "lang" | "privateClass">> & {
    day: number;
    addOns?: Partial<AddOns>;
    nv?: { status: NaverStatus; request?: string };
  };

const ROWS: SeedRow[] = [
  { day: -1, time: "10:00", ritualId: "plant-green", people: 2, status: "visited", reviewed: true, source: "naver", naverBookingId: "1183820204", nv: { status: "completed" }, customer: { name: "정○○", phone: "010-****-2281" } },
  { day: -1, time: "14:00", ritualId: "blue-landscape", people: 1, status: "no_show", reviewed: true, source: "naver", naverBookingId: "1183818377", nv: { status: "confirmed" }, customer: { name: "한○○", phone: "010-****-9034" } },
  { day: 0, time: "10:00", ritualId: "plant-flower", people: 2, addOns: { landscapeBite: 2, treasureHunt: 2 }, status: "visited", reviewed: true, source: "naver", naverBookingId: "1183820115", nv: { status: "confirmed", request: "친구 생일이라 사진 많이 찍고 싶어요" }, customer: { name: "김○○", phone: "010-****-4417" } },
  { day: 0, time: "13:00", ritualId: "blue-tiedye", people: 1, pickup: "delivery", status: "confirmed", reviewed: true, source: "naver", naverBookingId: "1183820562", nv: { status: "confirmed" }, customer: { name: "박○○", phone: "010-****-7720" }, memo: "택배 주소는 방문 때 받기로 했어요." },
  { day: 0, time: "16:00", ritualId: "blue-landscape", people: 2, lang: "en", status: "confirmed", reviewed: true, source: "form", customer: { name: "Emma L.", email: "emma.l@****.com" } },
  { day: 1, time: "10:00", ritualId: "plant-green", people: 3, addOns: { landscapeBite: 3 }, pickup: "visit", status: "confirmed", reviewed: false, source: "naver", naverBookingId: "1183821930", nv: { status: "confirmed" }, customer: { name: "이○○", phone: "010-****-5562" } },
  { day: 1, time: "13:00", ritualId: "blue-tiedye", people: 1, status: "pending", reviewed: true, source: "manual", customer: { name: "최○○", phone: "010-****-0148" }, memo: "인스타 DM으로 문의, 시간 조율 중" },
  { day: 2, time: "10:00", ritualId: "plant-flower", people: 2, status: "confirmed", reviewed: false, source: "naver", naverBookingId: "1183822471", nv: { status: "confirmed", request: "아이(7세) 함께 가도 될까요?" }, customer: { name: "오○○", phone: "010-****-3305" } },
  { day: 3, time: "14:00", ritualId: "blue-landscape", people: 2, lang: "ja", status: "inquiry", reviewed: true, source: "form", customer: { name: "Kenji S.", email: "kenji.s@****.jp" }, memo: "11월 오후 희망, 영어 가능" },
  { day: 4, time: "11:00", ritualId: null, privateClass: true, people: 2, addOns: { landscapeBite: 2, extraWork: 1 }, status: "confirmed", reviewed: false, source: "naver", naverBookingId: "1183823077", nv: { status: "confirmed", request: "결혼기념일이에요. 조용한 시간이면 좋겠어요." }, customer: { name: "문○○", phone: "010-****-4120" } },
  { day: 5, time: "10:00", ritualId: "plant-green", people: 4, addOns: { landscapeBite: 4, treasureHunt: 2 }, status: "confirmed", reviewed: true, source: "naver", naverBookingId: "1183823008", nv: { status: "confirmed" }, customer: { name: "윤○○", phone: "010-****-8816" } },
  { day: 5, time: "14:00", ritualId: "blue-tiedye", people: 1, lang: "zh", status: "confirmed", reviewed: false, source: "naver", naverBookingId: "1183823150", nv: { status: "confirmed" }, customer: { name: "서○○", phone: "010-****-6673" } },
  { day: 8, time: "14:00", ritualId: "blue-landscape", people: 2, status: "confirmed", reviewed: true, source: "manual", customer: { name: "강○○", phone: "010-****-1290" } },
];

function naverInfo(row: SeedRow & { addOns: AddOns }, date: string, today: string): NaverBooking | undefined {
  if (!row.nv || !row.naverBookingId) return undefined;
  const ritual = getRitual(row.ritualId);
  const productName = row.privateClass
    ? `${PRIVATE_CLASS.label} 리추얼 (나만의 풍경 물들이기)`
    : `${RITUAL_FAMILIES[ritual!.family].label} 리추얼 (${ritual!.detail || ritual!.name})`;
  const pickup = row.pickup ?? "onsite";
  const lang = row.lang ?? "ko";

  const options: NaverBooking["options"] = [
    ...(Object.keys(row.addOns) as (keyof AddOns)[])
      .filter((id) => row.addOns[id] > 0)
      .map((id) => ({ group: "추가 프로그램" as const, name: ADD_ONS[id].label, count: row.addOns[id], price: ADD_ONS[id].price ?? 0 })),
    { group: "수령 옵션", name: PICKUP[pickup].label, count: row.people, price: PICKUP[pickup].price },
    { group: "언어", name: LANG_LABEL[lang], count: row.people, price: 0 },
  ];
  const amount = prepaidAmount({ privateClass: !!row.privateClass, people: row.people, addOns: row.addOns, pickup });

  return {
    bookingId: row.naverBookingId,
    status: row.nv.status,
    productName,
    slot: localDateTime(date, row.time),
    bookedAt: localDateTime(addDays(today, Math.min(-2, row.day - 6)), "21:14"),
    people: row.people,
    options,
    payment: {
      amount,
      listAmount: row.privateClass ? undefined : amount + (PRICE.base - PRICE.naver) * row.people,
    },
    request: row.nv.request,
  };
}

export function seedReservations(now = new Date()): Reservation[] {
  const today = toISODate(now);
  const stamp = nowLocal(now);

  return ROWS.map((seed, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- nv는 naverInfo가 seed에서 직접 읽어요
    const { day, nv, ...rest } = seed;
    const row = { ...rest, addOns: { ...NO_ADD_ONS, ...seed.addOns } };
    const date = addDays(today, day);
    const channel = row.customer.phone ? "alimtalk" : "email";
    const messages: PlannedMessage[] = [];

    if (row.reviewed && (row.status === "confirmed" || row.status === "visited" || row.status === "no_show")) {
      // 확정 안내는 이미 나간 것으로: 방문 사흘 전, 늦어도 어제
      const confirmAt = localDateTime(addDays(today, Math.min(day - 3, -1)), "11:20");
      messages.push({ kind: "confirm", channel, state: "sent", scheduledAt: confirmAt, sentAt: confirmAt });
      const remindAt = localDateTime(addDays(date, -1), REMIND_TIME);
      const remindDone = remindAt <= stamp;
      messages.push({
        kind: "remind",
        channel,
        state: remindDone ? "sent" : "queued",
        scheduledAt: remindAt,
        sentAt: remindDone ? remindAt : undefined,
      });
    }

    return {
      id: `seed-${i + 1}`,
      date,
      memo: "",
      pickup: "onsite",
      lang: "ko",
      privateClass: false,
      ...row,
      naver: naverInfo({ ...seed, addOns: row.addOns }, date, today),
      messages,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
}
