"use client";

import type { ReactNode } from "react";
import { Sheet, SheetHeader, SheetSection } from "@/components/ui/sheet";
import { koMonthDay, koWeekday, shortDateTime } from "@/lib/dates";
import { renderMessage } from "@/lib/messages/templates";
import {
  CHANNEL_LABEL,
  MESSAGE_KIND_LABEL,
  MESSAGE_KIND_WHEN,
  MESSAGE_STATE_LABEL,
  type MessageKind,
} from "@/lib/messages/types";
import { NAVER_STATUS_LABEL, type NaverBooking, type NaverOptionGroup } from "@/lib/naver/types";
import {
  ADD_ONS,
  LANG_LABEL,
  PICKUP,
  PRIVATE_CLASS,
  RITUALS,
  RITUAL_FAMILIES,
  formatWon,
  ritualText,
  type AddOnId,
} from "@/lib/rituals";
import { onsiteItemRange, prepaidAmount } from "@/lib/reservations/price";
import { STATUS_ACTIONS_ENABLED, STATUS_ACTIONS_LOCKED_HINT } from "@/lib/features";
import { reservationStore } from "@/lib/reservations/store";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations/types";
import { latest } from "./marks";

const STATUS_HINT: Partial<Record<ReservationStatus, string>> = {
  inquiry: "확정하면 확정 안내가 바로 대기열에 올라가요.",
  pending: "확정하면 확정 안내가 바로 대기열에 올라가요.",
  confirmed: "전날 18:00에 리마인드가 나가요. 취소·노쇼로 바꾸면 남은 안내는 멈춰요.",
  visited: "다음 단계는 탄생 기록이에요.",
};

const SOURCE_TEXT: Record<Reservation["source"], string> = {
  naver: "네이버 예약",
  form: "문의폼",
  manual: "직접 입력",
};

/** 이용 시간 2시간 */
function endTime(time: string) {
  const h = Number(time.slice(0, 2)) + 2;
  return `${String(h).padStart(2, "0")}:${time.slice(3)}`;
}

export function ReservationDetailSheet({
  reservation: r,
  today,
  onClose,
}: {
  reservation: Reservation | null;
  today: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={r !== null} onClose={onClose} label="예약 상세">
      {r && <Detail key={r.id} r={r} today={today} onClose={onClose} />}
    </Sheet>
  );
}

const locked = !STATUS_ACTIONS_ENABLED;

function Detail({ r, today, onClose }: { r: Reservation; today: string; onClose: () => void }) {
  const setStatus = (s: ReservationStatus) => reservationStore.setStatus(r.id, s);
  const unreviewed = !r.reviewed && r.status === "confirmed";

  const primary =
    r.status === "pending" || r.status === "inquiry"
      ? { label: "확정하고 안내 보내기", to: "confirmed" as const }
      : r.status === "confirmed" && r.reviewed && r.date <= today
        ? { label: "방문 체크", to: "visited" as const }
        : null;

  const addOns = (Object.keys(r.addOns) as AddOnId[]).filter((id) => r.addOns[id] > 0);
  const [itemMin, itemMax] = onsiteItemRange(r.people);

  return (
    <>
      <SheetHeader
        title={`${r.customer.name} · ${r.people}명`}
        sub={`${koMonthDay(r.date)} (${koWeekday(r.date)}) ${r.time}–${endTime(r.time)} · ${
          r.privateClass ? `${PRIVATE_CLASS.full} · ` : ""
        }${ritualText(r.ritualId)}`}
        onClose={onClose}
      />

      <div className="flex flex-1 flex-col gap-7 px-6 py-5">
        {unreviewed && (
          <div className="rounded-lg bg-jjok-soft px-4 py-3">
            <p className="text-[13px] font-semibold text-jjok">네이버에서 바로확정된 새 예약이에요.</p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              손님은 네이버 확정 알림을 이미 받았어요. 확인하면 씬오브제주 카카오 안내와 전날 리마인드가 잡혀요.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="btn btn-jjok"
                disabled={locked}
                onClick={() => reservationStore.review(r.id)}
              >
                확인하고 안내 잡기
              </button>
              {locked && <span className="hint">{STATUS_ACTIONS_LOCKED_HINT}</span>}
            </div>
          </div>
        )}

        <SheetSection title="상태" aside={locked ? STATUS_ACTIONS_LOCKED_HINT : undefined}>
          <div role="radiogroup" aria-label="예약 상태" className="flex flex-wrap gap-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={r.status === s}
                disabled={locked}
                onClick={() => setStatus(s)}
                className={`rounded-md border px-2.5 py-1 text-[13px] disabled:cursor-not-allowed ${
                  r.status === s
                    ? "border-ink font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]"
                    : locked
                      ? "border-line-2 text-ink-3"
                      : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {!unreviewed && STATUS_HINT[r.status] && <p className="hint mt-2">{STATUS_HINT[r.status]}</p>}
          {primary && (
            <button type="button" className="btn btn-jjok mt-3" disabled={locked} onClick={() => setStatus(primary.to)}>
              {primary.label}
            </button>
          )}
        </SheetSection>

        {r.privateClass && (
          <SheetSection title="리추얼" aside="씬오브유는 코스가 같아요. 현장에서 정해도 돼요">
            <div className="flex flex-wrap gap-1">
              {RITUALS.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  aria-pressed={r.ritualId === rt.id}
                  onClick={() => reservationStore.update(r.id, { ritualId: r.ritualId === rt.id ? null : rt.id })}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] ${
                    r.ritualId === rt.id ? "border-ink font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]" : "border-line text-ink-2 hover:border-ink-3"
                  }`}
                >
                  <span className={`size-2 rounded-full ${rt.family === "blue" ? "bg-jjok" : "bg-moss"}`} />
                  {RITUAL_FAMILIES[rt.family].label} · {rt.name}
                </button>
              ))}
            </div>
          </SheetSection>
        )}

        <SheetSection title="예약 정보">
          <Rows>
            <Row label="연락처">{r.customer.phone ?? r.customer.email ?? "—"}</Row>
            <Row label="추가 프로그램">
              {addOns.length === 0
                ? "없음"
                : addOns.map((id) => `${ADD_ONS[id].label} ${r.addOns[id]}`).join(", ")}
            </Row>
            <Row label="수령">
              {PICKUP[r.pickup].label}
              <span className="block text-[13px] text-ink-3">{PICKUP[r.pickup].note}</span>
            </Row>
            <Row label="안내 언어">{LANG_LABEL[r.lang]}</Row>
            <Row label="들어온 곳">{SOURCE_TEXT[r.source]}</Row>
          </Rows>
        </SheetSection>

        <SheetSection title="결제">
          <Rows>
            <Row label="미리 결제">
              {r.naver ? (
                <>
                  {formatWon(r.naver.payment.amount)} · 네이버페이
                  {r.naver.payment.listAmount && (
                    <span className="ml-1.5 text-[13px] text-ink-3 line-through">
                      {formatWon(r.naver.payment.listAmount)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-ink-3">
                  없음 · 네이버 기준이면 {formatWon(prepaidAmount(r))}
                </span>
              )}
            </Row>
            <Row label="현장 결제">
              아이템 {formatWon(itemMin)}~{formatWon(itemMax)}
              <span className="block text-[13px] text-ink-3">
                아이템은 현장에서 골라요(1인 1개 기준){r.addOns.extraWork > 0 && " · 추가작업은 피염물 값만"}
              </span>
            </Row>
          </Rows>
        </SheetSection>

        {r.naver && <NaverSection naver={r.naver} />}

        <SheetSection title="카카오 안내" aside="채널 연결 전 · 미리보기">
          <ul className="flex flex-col gap-3">
            {(["confirm", "remind", "scene"] as MessageKind[]).map((kind) => {
              const m = latest(r.messages, kind);
              return (
                <li key={kind}>
                  <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                    <b className="font-semibold">{MESSAGE_KIND_LABEL[kind]}</b>
                    <span className="hint">
                      {m
                        ? `${CHANNEL_LABEL[m.channel]} · ${shortDateTime(m.sentAt ?? m.scheduledAt)}`
                        : MESSAGE_KIND_WHEN[kind]}
                    </span>
                    <span
                      className={`ml-auto text-[13px] ${m?.state === "queued" ? "font-semibold text-jjok" : "text-ink-3"}`}
                    >
                      {m
                        ? MESSAGE_STATE_LABEL[m.state]
                        : kind === "scene"
                          ? "기록 후"
                          : unreviewed
                            ? "확인 후"
                            : kind === "remind" && r.status === "confirmed"
                              ? "전날 18시가 지나 건너뜀"
                              : "아직"}
                    </span>
                  </div>
                  <p className="rounded-lg bg-sheet px-3 py-2 text-[13px] leading-relaxed text-ink-2">
                    {renderMessage(kind, r)}
                  </p>
                </li>
              );
            })}
          </ul>
        </SheetSection>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">메모</span>
          <textarea
            defaultValue={r.memo}
            rows={3}
            placeholder="당일 참고할 것, 택배 주소 받을 일 등"
            className="field resize-y"
            onBlur={(e) => {
              if (e.target.value !== r.memo) reservationStore.update(r.id, { memo: e.target.value });
            }}
          />
        </label>

        <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
          <button type="button" className="btn" disabled>
            탄생 기록 쓰기
          </button>
          <span className="hint">탄생 기록 화면과 함께 열려요</span>
        </div>
      </div>
    </>
  );
}

const OPTION_GROUPS: NaverOptionGroup[] = ["가격분류", "추가 프로그램", "수령 옵션", "언어"];

/** 네이버에서 넘어온 원본 정보. 어드민에서 고치지 않고 보여주기만 해요. */
function NaverSection({ naver }: { naver: NaverBooking }) {
  return (
    <SheetSection title="네이버 예약 원본" aside={`예약번호 ${naver.bookingId}`}>
      <Rows>
        <Row label="상품">{naver.productName}</Row>
        <Row label="회차">{shortDateTime(naver.slot)} · 2시간</Row>
        <Row label="인원">{naver.people}명</Row>
        {OPTION_GROUPS.map((group) => {
          const items = naver.options.filter((o) => o.group === group);
          if (items.length === 0) return null;
          return (
            <Row key={group} label={group}>
              {items
                .map((o) => `${o.name} ${o.count}${o.price ? ` (${formatWon(o.price * o.count)})` : ""}`)
                .join(", ")}
            </Row>
          );
        })}
        <Row label="결제">
          {formatWon(naver.payment.amount)}
          {naver.payment.refund ? ` · 환불 ${formatWon(naver.payment.refund)}` : ""}
        </Row>
        <Row label="상태">{NAVER_STATUS_LABEL[naver.status]}</Row>
        {naver.bookedAt && <Row label="신청">{shortDateTime(naver.bookedAt)}</Row>}
        {naver.channel && <Row label="유입경로">{naver.channel}</Row>}
        {naver.maskedPhone && <Row label="전화번호">{naver.maskedPhone} · 네이버가 가린 번호</Row>}
        {naver.request && <Row label="요청사항">“{naver.request}”</Row>}
      </Rows>
    </SheetSection>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line-2 rounded-lg border border-line text-[13px]">{children}</dl>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 px-3 py-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
