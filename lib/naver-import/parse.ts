import type { NaverBooking, NaverBookingDetail, NaverStatus } from "@/lib/naver/types";
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
  NAVER_COUNT_COLUMN,
  NAVER_FIELDS,
  NAVER_IGNORE_OPTIONS,
  NAVER_OPTION_NAMES,
  NAVER_PEOPLE_WORD,
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

/** 열 이름 줄 찾기: 예약번호 열이 있는 첫 줄. 네이버 엑셀은 위에 안내 문구 두 줄이 있어요. */
function findHeaderRow(table: string[][]) {
  const i = table.slice(0, 10).findIndex((row) => matchColumns(row).index.bookingId !== undefined);
  return Math.max(0, i);
}

type CountColumn = { index: number; kind: "옵션" | "필수" | "가격분류"; name: string };

/** "옵션2-한국어" 같은 수량 칸들. "… 결제금액" 칸은 빼요. */
function countColumns(headers: string[]): CountColumn[] {
  return headers.flatMap((h, index) => {
    const m = h.trim().match(NAVER_COUNT_COLUMN);
    if (!m || /결제금액$/.test(h.trim())) return [];
    return [{ index, kind: m[1] as CountColumn["kind"], name: m[2].trim() }];
  });
}

const isMasked = (s: string) => s.includes("*");
const num = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

/** 첫 줄(안내 문구가 있으면 그 아래)은 열 이름, 나머지는 예약 한 줄씩 */
export function parseNaverSheet(table: string[][]): { match: ColumnMatch } & ParsedRows {
  const headerAt = findHeaderRow(table);
  const headers = table[headerAt] ?? [];
  const body = table.slice(headerAt + 1);
  const match = matchColumns(headers);
  const counts = countColumns(headers);
  if (counts.length) {
    // 한 칸짜리 옵션·인원 열이 없으면, 항목별 수량 칸에서 읽는다고 보여줘요.
    if (match.index.options === undefined) match.header.options = `항목별 수량 칸 ${counts.length}개`;
    if (match.index.people === undefined) match.header.people = "참가비·아이템 수량으로 계산";
    const used = new Set(counts.map((c) => headers[c.index]).concat(counts.map((c) => `${headers[c.index]} 결제금액`)));
    match.unused = match.unused.filter((h) => !used.has(h));
  }
  if (match.missingRequired.length > 0) return { match, rows: [], errors: [] };

  const col = (name: string) => headers.findIndex((h) => norm(h) === norm(name));
  const extra = {
    channel: col("유입경로"),
    refund: col("환불금액"),
    answers: headers.flatMap((h, i) => (h.startsWith("예약자입력정보") ? [i] : [])),
  };

  const read = new Set([extra.channel, extra.refund, ...extra.answers].filter((i) => i >= 0).map((i) => headers[i]));
  match.unused = match.unused.filter((h) => !read.has(h));

  const rows: ReservationInput[] = [];
  const errors: RowError[] = [];

  body.forEach((cells, i) => {
    if (cells.every((c) => !String(c ?? "").trim())) return;
    const rowNo = headerAt + i + 2; // 엑셀에서 보이는 줄 번호
    const cell = (idx: number) => (idx < 0 ? "" : String(cells[idx] ?? "").trim());
    const get = (f: NaverField) => {
      const idx = match.index[f];
      return idx === undefined ? "" : cell(idx);
    };

    const when = parseDateTime(get("date"), get("time"));
    if (!when) return errors.push({ row: rowNo, reason: `날짜를 못 읽었어요: "${get("date")}"` });

    const product = get("product");
    const rule = NAVER_PRODUCT_RULES.find((r) => norm(product).includes(norm(r.includes)));
    if (!rule) return errors.push({ row: rowNo, reason: `상품을 못 찾았어요: "${product}"` });

    const bookingId = get("bookingId");
    if (!bookingId) return errors.push({ row: rowNo, reason: "예약번호가 비어 있어요" });

    // 옵션: 한 칸("풍경한입(2), …")이거나, 항목마다 수량 칸이 따로 있거나
    const picked = counts
      .map((c) => ({ ...c, count: Number(cell(c.index)) || 0 }))
      .filter((c) => c.count > 0 && !NAVER_IGNORE_OPTIONS.some((w) => c.name.includes(w)));
    const optionText =
      get("options") ||
      picked
        .filter((c) => c.kind !== "가격분류")
        .map((c) => `${c.name}(${c.count})`)
        .join(", ");
    const people = Math.max(1, parseInt(get("people"), 10) || guessPeople(picked));
    const opts = parseOptions(optionText, people);
    // 가격분류(아이템·참가비)는 원본 그대로 남겨요
    for (const c of picked.filter((c) => c.kind === "가격분류")) {
      opts.raw.push({ group: "가격분류", name: c.name, count: c.count, price: 0 });
    }

    // 가격분류 금액: "… 결제금액" 칸에서 1인(1개) 값을 구해요
    for (const o of opts.raw) {
      if (o.group !== "가격분류") continue;
      const total = num(cell(col(`${headers[counts.find((c) => c.name === o.name)?.index ?? -1] ?? ""} 결제금액`)));
      if (total && o.count) o.price = Math.round(total / o.count);
    }

    const naverStatus = NAVER_STATUS_TEXT[norm(get("status"))] ?? "confirmed";
    const at = (name: string) => {
      const v = parseDateTime(cell(col(name)), "");
      return v ? `${v.date}T${v.time}` : undefined;
    };
    const text = (name: string) => cell(col(name)) || undefined;
    const detail: NaverBookingDetail = {
      orderNo: text("주문번호"),
      productOrderNo: text("상품주문번호"),
      statusText: get("status") || undefined,
      bookingType: text("예약유형"),
      email: text("이메일"),
      visitorName: text("방문자"),
      visitorPhone: text("방문자전화번호"),
      payAmount: num(cell(col("결제금액"))) || undefined,
      couponDiscount: num(cell(col("쿠폰적용금액"))) || undefined,
      cardDiscount: num(cell(col("카드할인금액"))) || undefined,
      payMethod: text("결제수단"),
      payStatus: text("결제상태"),
      cancelFee: num(cell(col("취소수수료"))) || undefined,
      staffMemo: text("직원메모"),
      confirmedAt: at("예약확정일시"),
      completedAt: at("이용완료일시"),
      cancelReason: text("취소사유"),
      answers: extra.answers
        .map((i) => ({ question: headers[i].replace(/^예약자입력정보\d*-/, "").trim(), answer: cell(i) }))
        .filter((a) => a.answer),
      raw: Object.fromEntries(headers.map((h, i) => [h, cell(i)]).filter(([h, v]) => h && v)),
    };
    const canceledAt = at("예약취소일시");
    const bookedAt = parseDateTime(get("bookedAt"), "");
    const amount = num(get("amount"));
    const refund = num(cell(extra.refund));
    const answers = extra.answers.map(cell).filter(Boolean);
    const request = [get("request"), ...answers].filter(Boolean).join(" / ");
    const phone = get("phone");

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
        // 실제 엑셀은 상품마다 가격이 달라서(푸른풍경 7만원 등) 정가를 짐작하지 않아요. 예시 표에서만 계산해요.
        listAmount: counts.length || rule.privateClass ? undefined : amount + (PRICE.base - PRICE.naver) * people,
        refund: refund || undefined,
      },
      request: request || undefined,
      channel: cell(extra.channel) || undefined,
      maskedPhone: phone && isMasked(phone) ? phone : undefined,
      canceledAt,
      detail,
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
      // 네이버가 가린 번호(******1234)는 안내를 보낼 수 없어서 연락처로 두지 않아요.
      customer: { name: get("name"), phone: phone && !isMasked(phone) ? phone : undefined },
      memo: "",
    });
  });

  return { match, rows, errors };
}

/**
 * 인원 열이 없을 때: "참가비" 수량이 있으면 그게 인원이에요.
 * 옛 상품은 아이템 수와 언어 선택 수 중 큰 쪽으로 어림해요.
 */
function guessPeople(picked: (CountColumn & { count: number })[]) {
  const sum = (xs: { count: number }[]) => xs.reduce((n, x) => n + x.count, 0);
  const fees = picked.filter((c) => c.kind === "가격분류" && c.name.includes(NAVER_PEOPLE_WORD));
  if (fees.length) return sum(fees);
  const langNames = Object.keys(NAVER_OPTION_NAMES.lang).map(norm);
  const items = sum(picked.filter((c) => c.kind === "가격분류"));
  const langs = sum(picked.filter((c) => langNames.includes(norm(c.name))));
  return Math.max(items, langs, 1);
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
  // "26. 4. 10.(금)"처럼 연도가 두 자리인 것도 받아요.
  const ymd = dateText.match(/(\d{4}|\d{2}(?=\s*[.년]))\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  const mdy = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let y: number, m: number, d: number;
  if (ymd) [y, m, d] = [Number(ymd[1]) < 100 ? 2000 + Number(ymd[1]) : Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
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
