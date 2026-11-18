import "server-only";
import { nowLocal, type LocalDateTime } from "@/lib/dates";
import type { NaverBooking } from "@/lib/naver/types";
import { NO_ADD_ONS } from "@/lib/rituals";
import { cancelFromNaver, withStatus } from "@/lib/reservations/logic";
import type { Reservation, ReservationInput, ReservationStatus } from "@/lib/reservations/types";
import { db, must } from "./supabase";

/*
 * 예약 DB 읽기·쓰기(서버 전용). 화면은 app/admin/reservations/actions.ts를 거쳐 여기를 불러요.
 * 테이블 설명은 supabase/migrations/20261118120000_reservations.sql.
 */

// ── 시각: 화면은 제주 현지 "2026-04-10T15:05", DB는 timestamptz ─────────────

const KST = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

function toTimestamp(local: LocalDateTime | undefined): string | null {
  if (!local) return null;
  return `${local.length === 16 ? `${local}:00` : local}+09:00`;
}

function toLocal(ts: string | null | undefined): LocalDateTime | undefined {
  if (!ts) return undefined;
  const d = new Date(new Date(ts).getTime() + KST);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ── naver_bookings ─────────────────────────────────────────────────────────

type NaverRow = {
  booking_id: string;
  order_no: string | null;
  product_order_no: string | null;
  status: NaverBooking["status"];
  status_text: string | null;
  booking_type: string | null;
  channel: string | null;
  booker_name: string | null;
  booker_phone: string | null;
  booker_phone_masked: string | null;
  booker_email: string | null;
  visitor_name: string | null;
  visitor_phone: string | null;
  product_name: string;
  slot_at: string;
  people: number;
  options: NaverBooking["options"];
  answers: { question: string; answer: string }[];
  request: string | null;
  pay_amount: number | null;
  coupon_discount: number | null;
  card_discount: number | null;
  paid_amount: number | null;
  pay_method: string | null;
  pay_status: string | null;
  refund_amount: number | null;
  cancel_fee: number | null;
  staff_memo: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  sources: string[];
  raw: Record<string, string> | null;
  updated_at?: string;
};

export type NaverSource = "excel" | "mail";

const isMasked = (v: string | null | undefined) => !!v && v.includes("*");

function naverToRow(n: NaverBooking, customer: ReservationInput["customer"], source: NaverSource): NaverRow {
  const d = n.detail ?? {};
  return {
    booking_id: n.bookingId,
    order_no: d.orderNo ?? null,
    product_order_no: d.productOrderNo ?? null,
    status: n.status,
    status_text: d.statusText ?? null,
    booking_type: d.bookingType ?? null,
    channel: n.channel ?? null,
    booker_name: customer.name || null,
    // 가려진 번호는 booker_phone에 넣지 않아요(가리지 않은 번호를 덮지 않게)
    booker_phone: customer.phone && !isMasked(customer.phone) ? customer.phone : null,
    booker_phone_masked: n.maskedPhone ?? (isMasked(customer.phone) ? customer.phone! : null),
    booker_email: d.email ?? customer.email ?? null,
    visitor_name: d.visitorName ?? null,
    visitor_phone: d.visitorPhone ?? null,
    product_name: n.productName,
    slot_at: toTimestamp(n.slot)!,
    people: n.people,
    options: n.options,
    answers: d.answers ?? [],
    request: n.request ?? null,
    pay_amount: d.payAmount ?? null,
    coupon_discount: d.couponDiscount ?? null,
    card_discount: d.cardDiscount ?? null,
    paid_amount: n.payment.amount || null,
    pay_method: d.payMethod ?? null,
    pay_status: d.payStatus ?? null,
    refund_amount: n.payment.refund ?? null,
    cancel_fee: d.cancelFee ?? null,
    staff_memo: d.staffMemo ?? null,
    requested_at: toTimestamp(n.bookedAt),
    confirmed_at: toTimestamp(d.confirmedAt),
    completed_at: toTimestamp(d.completedAt),
    canceled_at: toTimestamp(n.canceledAt),
    cancel_reason: d.cancelReason ?? null,
    sources: [source],
    raw: d.raw ?? null,
  };
}

function rowToNaver(r: NaverRow): NaverBooking {
  return {
    bookingId: r.booking_id,
    status: r.status,
    productName: r.product_name,
    slot: toLocal(r.slot_at)!,
    bookedAt: toLocal(r.requested_at),
    people: r.people,
    options: r.options ?? [],
    payment: { amount: r.paid_amount ?? 0, refund: r.refund_amount ?? undefined },
    request: r.request ?? undefined,
    canceledAt: toLocal(r.canceled_at),
    channel: r.channel ?? undefined,
    maskedPhone: r.booker_phone_masked ?? undefined,
    detail: {
      orderNo: r.order_no ?? undefined,
      productOrderNo: r.product_order_no ?? undefined,
      statusText: r.status_text ?? undefined,
      bookingType: r.booking_type ?? undefined,
      email: r.booker_email ?? undefined,
      visitorName: r.visitor_name ?? undefined,
      visitorPhone: r.visitor_phone ?? undefined,
      payAmount: r.pay_amount ?? undefined,
      couponDiscount: r.coupon_discount ?? undefined,
      cardDiscount: r.card_discount ?? undefined,
      payMethod: r.pay_method ?? undefined,
      payStatus: r.pay_status ?? undefined,
      cancelFee: r.cancel_fee ?? undefined,
      staffMemo: r.staff_memo ?? undefined,
      confirmedAt: toLocal(r.confirmed_at),
      completedAt: toLocal(r.completed_at),
      cancelReason: r.cancel_reason ?? undefined,
      answers: r.answers ?? [],
    },
  };
}

/**
 * 같은 예약번호를 다시 받으면 합쳐요. 새로 받은 값이 비어 있으면 원래 값을 지켜요.
 * 엑셀(이름·번호가 가려짐)과 메일(번호가 있을 수 있음)을 섞어 받아도 아는 것이 줄지 않게요.
 */
function mergeNaver(prev: NaverRow | undefined, next: NaverRow): NaverRow {
  if (!prev) return next;
  const merged = { ...prev } as Record<string, unknown>;
  for (const [k, v] of Object.entries(next)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    merged[k] = v;
  }
  // 가려진 이름이 가리지 않은 이름을 덮지 않게요
  if (isMasked(next.booker_name) && prev.booker_name && !isMasked(prev.booker_name)) {
    merged.booker_name = prev.booker_name;
  }
  merged.sources = [...new Set([...(prev.sources ?? []), ...next.sources])];
  return merged as NaverRow;
}

// ── reservations ───────────────────────────────────────────────────────────

type ReservationRow = {
  id: string;
  date: string;
  time: string;
  ritual_id: string | null;
  private_class: boolean;
  people: number;
  add_ons: Reservation["addOns"];
  pickup: Reservation["pickup"];
  lang: Reservation["lang"];
  status: ReservationStatus;
  reviewed: boolean;
  source: Reservation["source"];
  naver_booking_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  memo: string;
  messages: Reservation["messages"];
  created_at: string;
  updated_at: string;
  naver?: NaverRow | null;
};

const SELECT = "*, naver:naver_bookings(*)";

function rowToReservation(r: ReservationRow): Reservation {
  return {
    id: r.id,
    date: r.date,
    time: r.time,
    ritualId: r.ritual_id,
    privateClass: r.private_class,
    people: r.people,
    addOns: { ...NO_ADD_ONS, ...r.add_ons },
    pickup: r.pickup,
    lang: r.lang,
    status: r.status,
    reviewed: r.reviewed,
    source: r.source,
    naverBookingId: r.naver_booking_id ?? undefined,
    naver: r.naver ? rowToNaver(r.naver) : undefined,
    customer: {
      name: r.customer_name,
      phone: r.customer_phone ?? undefined,
      email: r.customer_email ?? undefined,
    },
    memo: r.memo,
    messages: r.messages ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function reservationToRow(r: ReservationInput | Reservation) {
  return {
    date: r.date,
    time: r.time,
    ritual_id: r.ritualId,
    private_class: r.privateClass,
    people: r.people,
    add_ons: r.addOns,
    pickup: r.pickup,
    lang: r.lang,
    status: r.status,
    reviewed: r.reviewed,
    source: r.source,
    naver_booking_id: r.naverBookingId ?? null,
    customer_name: r.customer.name,
    customer_phone: r.customer.phone ?? null,
    customer_email: r.customer.email ?? null,
    memo: r.memo,
    messages: "messages" in r ? r.messages : [],
  };
}

export async function listReservations(): Promise<Reservation[]> {
  const rows = must(
    await db().from("reservations").select(SELECT).order("date").order("time").returns<ReservationRow[]>(),
  );
  return rows.map(rowToReservation);
}

async function getReservation(id: string): Promise<Reservation> {
  const row = must(await db().from("reservations").select(SELECT).eq("id", id).single<ReservationRow>());
  return rowToReservation(row);
}

async function saveReservation(r: Reservation): Promise<Reservation> {
  must(
    await db()
      .from("reservations")
      .update({ ...reservationToRow(r), updated_at: new Date().toISOString() })
      .eq("id", r.id),
  );
  return getReservation(r.id);
}

export async function addReservation(input: ReservationInput): Promise<Reservation> {
  const now = nowLocal();
  const { id } = must(
    await db().from("reservations").insert(reservationToRow(input)).select("id").single<{ id: string }>(),
  );
  const created = await getReservation(id);
  // 직접 넣은 예약은 확인한 것으로 봐요. 처음부터 "확정"이면 확정 안내도 바로 대기열에 올라가요.
  return created.reviewed ? saveReservation(withStatus({ ...created, reviewed: false }, created.status, now)) : created;
}

export async function setReservationStatus(id: string, status: ReservationStatus) {
  return saveReservation(withStatus(await getReservation(id), status, nowLocal()));
}

/** 네이버 바로확정 예약을 대표님이 확인: 이때 카카오 확정 안내·리마인드가 잡혀요. */
export async function reviewReservation(id: string) {
  const r = await getReservation(id);
  return saveReservation(withStatus(r, r.status, nowLocal()));
}

export async function updateReservation(id: string, patch: Partial<Pick<Reservation, "memo" | "ritualId">>) {
  return saveReservation({ ...(await getReservation(id)), ...patch });
}

// ── 네이버 예약 들이기(엑셀·메일 공통) ─────────────────────────────────────

export type ImportResult = { added: number; updated: number };

/**
 * 네이버 예약번호로 합쳐요.
 * - naver_bookings: 받은 값으로 갱신(빈 값은 원래 값 유지)
 * - reservations: 없으면 새로 만들고, 있으면 날짜·인원·옵션만 따라가요.
 *   상태·확인·메모·리추얼은 어드민에서 정한 걸 지키고, 네이버에서 취소된 것만 취소로 바꿔요.
 */
export async function importNaverRows(rows: ReservationInput[], source: NaverSource): Promise<ImportResult> {
  const withNaver = rows.filter((r) => r.naver && r.naverBookingId);
  if (withNaver.length === 0) return { added: 0, updated: 0 };
  const ids = withNaver.map((r) => r.naverBookingId!);
  const now = nowLocal();

  const prevNaver = must(await db().from("naver_bookings").select("*").in("booking_id", ids).returns<NaverRow[]>());
  const naverRows = withNaver.map((r) =>
    mergeNaver(
      prevNaver.find((p) => p.booking_id === r.naverBookingId),
      naverToRow(r.naver!, r.customer, source),
    ),
  );
  must(
    await db()
      .from("naver_bookings")
      .upsert(naverRows.map((n) => ({ ...n, updated_at: new Date().toISOString() }))),
  );

  const existing = must(
    await db().from("reservations").select(SELECT).in("naver_booking_id", ids).returns<ReservationRow[]>(),
  ).map(rowToReservation);

  let added = 0;
  let updated = 0;
  for (const row of withNaver) {
    const naver = naverRows.find((n) => n.booking_id === row.naverBookingId)!;
    const own = row.customer.phone && !isMasked(row.customer.phone) ? row.customer.phone : undefined;
    const phone = own ?? naver.booker_phone ?? undefined;
    const prev = existing.find((r) => r.naverBookingId === row.naverBookingId);

    if (!prev) {
      must(await db().from("reservations").insert(reservationToRow({ ...row, customer: { ...row.customer, phone } })));
      added++;
      continue;
    }

    const name = isMasked(row.customer.name) && !isMasked(prev.customer.name) ? prev.customer.name : row.customer.name;
    const merged: Reservation = {
      ...prev,
      date: row.date,
      time: row.time,
      people: row.people,
      addOns: row.addOns,
      pickup: row.pickup,
      lang: row.lang,
      privateClass: row.privateClass,
      ritualId: prev.ritualId ?? row.ritualId,
      customer: { ...prev.customer, name: name || prev.customer.name, phone: prev.customer.phone ?? phone },
    };
    await saveReservation(row.naver!.status === "canceled" ? cancelFromNaver(merged, now) : merged);
    updated++;
  }
  return { added, updated };
}

/** 취소 메일: 예약번호만 있어도 이미 들어온 예약을 취소로 바꿔요. */
export async function cancelNaverBooking(bookingId: string): Promise<boolean> {
  const now = nowLocal();
  must(
    await db()
      .from("naver_bookings")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("booking_id", bookingId),
  );
  const rows = must(
    await db().from("reservations").select(SELECT).eq("naver_booking_id", bookingId).returns<ReservationRow[]>(),
  );
  if (rows.length === 0) return false;
  await saveReservation(cancelFromNaver(rowToReservation(rows[0]), now));
  return true;
}
