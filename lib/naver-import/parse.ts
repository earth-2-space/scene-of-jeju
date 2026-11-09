import type { NaverBooking, NaverStatus } from "@/lib/naver/types";
import {
  ADD_ONS,
  LANG_LABEL,
  NO_ADD_ONS,
  PICKUP,
  PRICE,
  type AddOnId,
  type AddOns,
  type Lang,
  type Pickup,
} from "@/lib/rituals";
import type { ReservationInput, ReservationStatus } from "@/lib/reservations/types";
import {
  NAVER_FIELDS,
  NAVER_OPTION_NAMES,
  NAVER_PRODUCT_RULES,
  NAVER_STATUS_TEXT,
  type NaverField,
} from "./columns";

/**
 * 네이버 상태 → 어드민 상태. 바로확정이라 확정으로 들어오고,
 * 대표님이 "확인"하기 전까지는 카카오 안내를 잡지 않아요(reviewed: false).
 */
const ADMIN_STATUS_FROM_NAVER: Record<NaverStatus, ReservationStatus> = {
  confirmed: "confirmed",
  completed: "visited",
  canceled: "canceled",
  no_show: "no_show",
};

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export type ColumnMatch = {
  /** 필드 → 엑셀 열 번호 */
  index: Partial<Record<NaverField, number>>;
  /** 필드 → 실제로 맞은 열 이름 */
  header: Partial<Record<NaverField, string>>;
  missingRequired: NaverField[];
  unused: string[];
};

export function matchColumns(headers: string[]): ColumnMatch {
  const normalized = headers.map(norm);
  const index: ColumnMatch["index"] = {};
  const header: ColumnMatch["header"] = {};

  for (const { field, candidates } of NAVER_FIELDS) {
    for (const c of candidates) {
      const i = normalized.indexOf(norm(c));
      if (i !== -1 && !Object.values(index).includes(i)) {
        index[field] = i;
        header[field] = headers[i];
        break;
      }
    }
  }

  const used = new Set(Object.values(index));
  return {
    index,
    header,
    missingRequired: NAVER_FIELDS.filter((f) => f.required && index[f.field] === undefined).map((f) => f.field),
    unused: headers.filter((h, i) => h.trim() && !used.has(i)),
  };
}

export type RowError = { row: number; reason: string };
export type ParsedRows = { rows: ReservationInput[]; errors: RowError[] };

/** 첫 줄은 열 이름, 나머지는 예약 한 줄씩 */
export function parseNaverSheet(table: string[][]): { match: ColumnMatch } & ParsedRows {
  const [headers = [], ...body] = table;
  const match = matchColumns(headers);
  if (match.missingRequired.length > 0) return { match, rows: [], errors: [] };

  const rows: ReservationInput[] = [];
  const errors: RowError[] = [];

  body.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) return;
    const rowNo = i + 2; // 엑셀에서 보이는 줄 번호
    const get = (f: NaverField) => {
      const idx = match.index[f];
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const when = parseDateTime(get("date"), get("time"));
    if (!when) return errors.push({ row: rowNo, reason: `날짜를 못 읽었어요: "${get("date")}"` });

    const product = get("product");
    const rule = NAVER_PRODUCT_RULES.find((r) => norm(product).includes(norm(r.includes)));
    if (!rule) return errors.push({ row: rowNo, reason: `상품을 못 찾았어요: "${product}"` });

    const bookingId = get("bookingId");
    if (!bookingId) return errors.push({ row: rowNo, reason: "예약번호가 비어 있어요" });

    const people = Math.max(1, parseInt(get("people"), 10) || 1);
    const opts = parseOptions(get("options"), people);
    const naverStatus = NAVER_STATUS_TEXT[norm(get("status"))] ?? "confirmed";
    const bookedAt = parseDateTime(get("bookedAt"), "");
    const amount = Number(get("amount").replace(/[^\d]/g, "")) || 0;
    const request = get("request");

    const naver: NaverBooking = {
      bookingId,
      status: naverStatus,
      productName: product,
      slot: `${when.date}T${when.time}`,
      bookedAt: bookedAt ? `${bookedAt.date}T${bookedAt.time}` : undefined,
      people,
      options: opts.raw,
      payment: {
        amount,
        listAmount: rule.privateClass ? undefined : amount + (PRICE.base - PRICE.naver) * people,
      },
      request: request || undefined,
    };

    rows.push({
      date: when.date,
      time: when.time,
      ritualId: rule.ritualId,
      privateClass: !!rule.privateClass,
      people,
      addOns: opts.addOns,
      pickup: opts.pickup,
      lang: opts.lang,
      status: ADMIN_STATUS_FROM_NAVER[naverStatus],
      reviewed: false,
      source: "naver",
      naverBookingId: bookingId,
      naver,
      customer: { name: get("name"), phone: get("phone") || undefined },
      memo: "",
    });
  });

  return { match, rows, errors };
}

/**
 * "풍경한입(2), 택배발송(1), English(2)" → 추가 프로그램·수령·언어.
 * 수량이 없으면 1로 봐요. 모르는 이름은 원문 그대로 남겨요.
 */
export function parseOptions(text: string, people: number) {
  const addOns: AddOns = { ...NO_ADD_ONS };
  let pickup: Pickup = "onsite";
  let lang: Lang = "ko";
  let langCount = 0;
  const raw: NaverBooking["options"] = [];

  for (const part of text.split(/[,/\n]/)) {
    const m = part.trim().match(/^(.+?)\s*(?:[(\[]\s*(\d+)\s*[)\]]|[x×]\s*(\d+))?$/i);
    if (!m) continue;
    const name = m[1].trim();
    const count = Number(m[2] ?? m[3] ?? 1);
    const key = norm(name);

    const addOn = Object.entries(NAVER_OPTION_NAMES.addOns).find(([k]) => norm(k) === key)?.[1] as AddOnId | undefined;
    const pick = Object.entries(NAVER_OPTION_NAMES.pickup).find(([k]) => norm(k) === key)?.[1] as Pickup | undefined;
    const lng = Object.entries(NAVER_OPTION_NAMES.lang).find(([k]) => norm(k) === key)?.[1] as Lang | undefined;

    if (addOn) {
      addOns[addOn] += count;
      raw.push({ group: "추가 프로그램", name: ADD_ONS[addOn].label, count, price: ADD_ONS[addOn].price ?? 0 });
    } else if (pick) {
      pickup = pick;
      raw.push({ group: "수령 옵션", name: PICKUP[pick].label, count, price: PICKUP[pick].price });
    } else if (lng) {
      // 여러 언어를 고르면 인원이 가장 많은 언어를 안내 언어로 봐요.
      if (count > langCount) {
        lang = lng;
        langCount = count;
      }
      raw.push({ group: "언어", name: LANG_LABEL[lng], count, price: 0 });
    } else {
      raw.push({ group: "추가 프로그램", name, count, price: 0 });
    }
  }

  if (!raw.some((o) => o.group === "수령 옵션")) {
    raw.push({ group: "수령 옵션", name: PICKUP.onsite.label, count: people, price: 0 });
  }
  return { addOns, pickup, lang, raw };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "2026.11.10", "2026-11-10", "2026. 11. 10.(화)", "2026.11.10 14:00", "11/10/2026" 처럼
 * 흔한 모양을 받아요. 시간은 따로 열이 있으면 그걸 써요("오후 2:00"도 받아요).
 */
export function parseDateTime(dateText: string, timeText: string): { date: string; time: string } | null {
  const ymd = dateText.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  const mdy = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let y: number, m: number, d: number;
  if (ymd) [y, m, d] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else if (mdy) [y, m, d] = [Number(mdy[3]), Number(mdy[1]), Number(mdy[2])];
  else return null;

  const rest = timeText || dateText.slice((ymd ?? mdy)!.index! + (ymd ?? mdy)![0].length);
  const t = rest.match(/(오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})/i);
  let hh = 10;
  let mm = 0;
  if (t) {
    hh = Number(t[2]);
    mm = Number(t[3]);
    const ampm = t[1]?.toUpperCase();
    if ((ampm === "오후" || ampm === "PM") && hh < 12) hh += 12;
    if ((ampm === "오전" || ampm === "AM") && hh === 12) hh = 0;
  }
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}` };
}
