import type { NaverBooking, NaverStatus } from "@/lib/naver/types";
import {
  NAVER_FIELDS,
  NAVER_IGNORE_OPTIONS,
  NAVER_PEOPLE_WORD,
  NAVER_PRODUCT_RULES,
  type NaverField,
} from "@/lib/naver-import/columns";
import { parseDateTime, parseOptions } from "@/lib/naver-import/parse";
import type { ReservationInput } from "@/lib/reservations/types";

/*
 * 네이버 예약 알림 메일 → 예약 한 건.
 *
 * 흐름(11/20): 네이버 예약 메일은 reservation@earth-2-space.com(Google Workspace)으로 와요.
 * 그 계정의 Apps Script가 5분마다 /api/naver-mail 로 보내고 → 여기서 읽어 → Supabase에 저장.
 *
 * 실제 메일(2026.11.16 "새로운 예약이 확정 되었습니다", 예약번호 1409004179) 기준 라벨:
 *   예약자명 김*혜님 · 예약신청 일시 2026.11.16. 16:06:28
 *   예약번호 · 예약상품 그린 리추얼 (나뭇잎 염색) · 이용일시 2026.11.23.(월) 오전 10:00
 *   결제상태 결제완료 · 결제수단 신용카드 간편결제 · 요청사항 -
 *   결제금액 "식물산책 프로그램 참가비(1) 50,000원 + …확인하였습니다.(1) 0원 + 1. 현장픽업(1) 0원 + 한국어(1) 0원 = 50,000원"
 * 메일에는 인원·옵션 칸이 따로 없어요. 결제금액 줄의 항목별 수량에서 인원(참가비)과 옵션을 읽어요.
 * 연락처도 없어요(이름은 가려져 와요). 취소·변경 메일은 샘플을 받으면 MAIL_KIND_WORDS만 맞추면 돼요.
 */

export type NaverMail = {
  /** 메일 고유 ID(Gmail message id). 같은 메일을 두 번 받아도 한 번만 넣어요 */
  id: string;
  subject: string;
  from?: string;
  /** 받은 시각(ISO) */
  receivedAt?: string;
  text?: string;
  html?: string;
};

export type MailKind = "new" | "cancel" | "change" | "unknown";

export type ParsedMail =
  | { ok: true; kind: "new" | "change"; bookingId: string; row: ReservationInput }
  | { ok: true; kind: "cancel"; bookingId: string; row?: ReservationInput }
  | { ok: false; kind: MailKind; reason: string; bookingId?: string };

/** 제목·본문 낱말로 메일 종류를 가려요. 위에서부터 먼저 맞는 것. */
export const MAIL_KIND_WORDS: { kind: MailKind; words: string[] }[] = [
  { kind: "cancel", words: ["취소"] },
  { kind: "change", words: ["변경"] },
  { kind: "new", words: ["새로운 예약", "확정", "신청", "새 예약", "예약이 접수", "예약 알림"] },
];

/** 엑셀 열 이름 후보에 메일에서 쓰일 법한 라벨을 더해요 */
const MAIL_LABELS: Partial<Record<NaverField, string[]>> = {
  bookingId: ["예약 번호"],
  name: ["예약자 이름", "예약자정보", "방문자"],
  phone: ["예약자 연락처", "휴대전화"],
  date: ["이용일시", "이용 일시", "예약일시", "방문일시", "이용일자"],
  product: ["예약 상품", "상품", "서비스"],
  people: ["인원수", "예약 인원", "수량"],
  options: ["추가 옵션", "선택 옵션"],
  amount: ["결제금액", "결제 금액", "결제예상금액", "총 결제금액"],
  request: ["요청사항", "요청 사항", "고객 요청사항"],
  bookedAt: ["예약신청 일시", "예약 신청 일시"],
};

/** 값만 보고 따로 읽는 칸(필드 표에는 없어요) */
const EXTRA_LABELS = { payStatus: "결제상태", payMethod: "결제수단" } as const;

function labelsFor(field: NaverField): string[] {
  const base = NAVER_FIELDS.find((f) => f.field === field)?.candidates ?? [];
  // 긴 라벨부터 봐야 "예약자 연락처"가 "예약자"에 먹히지 않아요.
  return [...new Set([...(MAIL_LABELS[field] ?? []), ...base])].sort((a, b) => b.length - a.length);
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/** HTML 메일을 줄 단위 글자로. 표 칸·줄바꿈은 줄로 나눠요. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h\d|dt|dd|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function toLines(mail: NaverMail): string[] {
  const text = mail.text?.trim() ? mail.text : htmlToText(mail.html ?? "");
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * 라벨 다음 값을 찾아요. "예약번호: 123", "예약번호 123", 또는 라벨만 있는 줄 다음 줄.
 * 라벨 뒤에 다른 라벨이 바로 오면 값이 없는 것으로 봐요.
 */
type LabelKey = NaverField | keyof typeof EXTRA_LABELS;
const ALL_LABELS: { field: LabelKey; label: string }[] = [
  ...NAVER_FIELDS.flatMap((f) => labelsFor(f.field).map((label) => ({ field: f.field as LabelKey, label: norm(label) }))),
  ...Object.entries(EXTRA_LABELS).map(([field, label]) => ({ field: field as LabelKey, label: norm(label) })),
].sort((a, b) => b.label.length - a.label.length);

/** 줄 머리에 붙은 라벨 중 가장 긴 것. "예약자 연락처"는 예약자(이름)가 아니라 연락처예요. */
function labelOf(line: string) {
  const n = norm(line);
  return ALL_LABELS.find((l) => n.startsWith(l.label));
}

function findValue(lines: string[], field: LabelKey, opts: { until?: RegExp } = {}): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hit = labelOf(line);
    if (!hit || hit.field !== field) continue;
    // 원문에서 라벨 글자 수만큼(공백 무시) 잘라 내요.
    let seen = 0;
    let cut = 0;
    while (cut < line.length && seen < hit.label.length) {
      if (!/\s/.test(line[cut])) seen++;
      cut++;
    }
    let value = line.slice(cut).replace(/^\s*[:：|ㅣ\-]?\s*/, "").trim();
    let j = i + 1;
    if (!value && lines[j] && !labelOf(lines[j])) value = lines[j++];
    // 결제금액처럼 줄이 접혀 오는 값은 끝 표시(= 50,000원)가 나올 때까지 이어 붙여요.
    if (opts.until) {
      while (value && !opts.until.test(value) && lines[j] && !labelOf(lines[j]) && j < i + 6) value += ` ${lines[j++]}`;
    }
    return value;
  }
  return "";
}

export function mailKind(mail: NaverMail, lines: string[]): MailKind {
  const head = `${mail.subject}\n${lines.slice(0, 6).join("\n")}`;
  return MAIL_KIND_WORDS.find((k) => k.words.some((w) => head.includes(w)))?.kind ?? "unknown";
}

export function parseNaverMail(mail: NaverMail): ParsedMail {
  const lines = toLines(mail);
  const kind = mailKind(mail, lines);
  const get = (f: LabelKey) => findValue(lines, f, f === "amount" ? { until: /=\s*[\d,]+\s*원/ } : {});

  const bookingId = get("bookingId").match(/\d[\d-]{5,}/)?.[0].replace(/-/g, "") ?? "";
  if (!bookingId) return { ok: false, kind, reason: "예약번호를 못 찾았어요" };
  if (kind === "unknown") return { ok: false, kind, bookingId, reason: "예약 알림 메일인지 모르겠어요" };

  const row = buildRow(get, bookingId, kind === "cancel" ? "canceled" : "confirmed");
  if (kind === "cancel") {
    // 취소 메일은 예약번호만 있어도 돼요. 이미 들어온 예약을 취소로 바꿔요.
    return { ok: true, kind, bookingId, row: "reason" in row ? undefined : row };
  }
  if ("reason" in row) return { ok: false, kind, bookingId, reason: row.reason };
  return { ok: true, kind, bookingId, row };
}

/**
 * "식물산책 프로그램 참가비(1) 50,000원 + 1. 현장픽업(1) 0원 + 한국어(1) 0원 = 50,000원"
 * → 항목(이름·수량·금액)과 합계. "=" 가 없으면 마지막 "…원"을 합계로 봐요.
 */
export function parsePayment(text: string) {
  const [itemsText, totalText] = text.includes("=") ? [text.slice(0, text.lastIndexOf("=")), text.slice(text.lastIndexOf("=") + 1)] : [text, ""];
  const items = itemsText
    .split(/\s\+\s/)
    .map((part) => part.trim().match(/^(.+?)\s*\((\d+)\)\s*([\d,]+)\s*원$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1].replace(/^\d+\.\s*/, "").trim(), count: Number(m[2]), price: Number(m[3].replace(/,/g, "")) }));
  const won = [...(totalText || text).matchAll(/([\d,]+)\s*원/g)];
  const total = won.length ? Number(won[won.length - 1][1].replace(/,/g, "")) : Number(text.replace(/[^\d]/g, "")) || 0;
  return { items, total };
}

function buildRow(
  get: (f: LabelKey) => string,
  bookingId: string,
  status: NaverStatus,
): ReservationInput | { reason: string } {
  const dateText = get("date");
  const when = parseDateTime(dateText, get("time"));
  if (!when) return { reason: `이용일시를 못 읽었어요: "${dateText}"` };

  const product = get("product");
  const rule = NAVER_PRODUCT_RULES.find((r) => norm(product).includes(norm(r.includes)));
  if (!rule) return { reason: `상품을 못 찾았어요: "${product}"` };

  const pay = parsePayment(get("amount"));
  const fees = pay.items.filter((it) => it.name.includes(NAVER_PEOPLE_WORD));
  const optionItems = pay.items.filter(
    (it) => !fees.includes(it) && !NAVER_IGNORE_OPTIONS.some((w) => it.name.includes(w)),
  );
  const people = Math.max(
    1,
    parseInt(get("people"), 10) || fees.reduce((n, it) => n + it.count, 0) || 1,
  );
  const opts = parseOptions(
    get("options") || optionItems.map((it) => `${it.name}(${it.count})`).join(", "),
    people,
  );
  // 참가비는 엑셀의 가격분류처럼 원본으로 남겨요(1인 가격).
  for (const it of fees) {
    opts.raw.push({ group: "가격분류", name: it.name, count: it.count, price: it.count ? Math.round(it.price / it.count) : it.price });
  }
  const amount = pay.total;
  const request = get("request").replace(/^-$/, "");
  const bookedAt = parseDateTime(get("bookedAt"), "");
  const name = get("name").replace(/\s*님$/, "");
  const phone = get("phone");
  const masked = phone.includes("*");

  const naver: NaverBooking = {
    bookingId,
    status,
    productName: product,
    slot: `${when.date}T${when.time}`,
    bookedAt: bookedAt ? `${bookedAt.date}T${bookedAt.time}` : undefined,
    people,
    options: opts.raw,
    // 상품마다 가격이 달라서(푸른풍경 7만원 등) 정가는 짐작하지 않아요(엑셀과 같아요).
    payment: { amount },
    request: request || undefined,
    maskedPhone: masked ? phone : undefined,
    detail: {
      payAmount: amount || undefined,
      payMethod: get("payMethod") || undefined,
      payStatus: get("payStatus") || undefined,
    },
  };

  return {
    date: when.date,
    time: when.time,
    ritualId: rule.ritualId,
    privateClass: !!rule.privateClass,
    people,
    addOns: opts.addOns,
    pickup: opts.pickup,
    lang: opts.lang,
    status: status === "canceled" ? "canceled" : "confirmed",
    reviewed: false,
    source: "naver",
    naverBookingId: bookingId,
    naver,
    // 가려진 번호(******1234)는 안내를 보낼 수 없어서 연락처로 두지 않아요.
    customer: { name, phone: phone && !masked ? phone : undefined },
    memo: "",
  };
}
