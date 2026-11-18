"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import {
  ADD_ONS,
  LANG_LABEL,
  NO_ADD_ONS,
  PICKUP,
  PRIVATE_CLASS,
  RITUALS,
  RITUAL_FAMILIES,
  type AddOnId,
  type Lang,
  type Pickup,
} from "@/lib/rituals";
import { reservationStore } from "@/lib/reservations/store";
import type {
  Reservation,
  ReservationInput,
  ReservationSource,
  ReservationStatus,
} from "@/lib/reservations/types";

const PRIVATE_ID = "private";

export function AddReservationSheet({
  open,
  defaultDate,
  onClose,
  onAdded,
}: {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
  onAdded: (r: Reservation) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="예약 추가">
      <SheetHeader title="예약 추가" sub="전화·DM으로 받은 예약을 직접 적어요." onClose={onClose} />
      <AddForm
        defaultDate={defaultDate}
        onDone={(r) => {
          onAdded(r);
          onClose();
        }}
      />
    </Sheet>
  );
}

function AddForm({ defaultDate, onDone }: { defaultDate: string; onDone: (r: Reservation) => void }) {
  const [product, setProduct] = useState<string>(RITUALS[0].id);
  const [source, setSource] = useState<ReservationSource>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const contact = String(f.get("contact") ?? "").trim();
    const count = (name: string) => Math.max(0, Number(f.get(name)) || 0);
    const privateClass = product === PRIVATE_ID;
    const input: ReservationInput = {
      date: String(f.get("date")),
      time: String(f.get("time")),
      ritualId: privateClass ? null : product,
      privateClass,
      people: Math.max(1, Number(f.get("people")) || 1),
      addOns: (Object.keys(NO_ADD_ONS) as AddOnId[]).reduce(
        (acc, id) => ({ ...acc, [id]: count(id) }),
        { ...NO_ADD_ONS },
      ),
      pickup: f.get("pickup") as Pickup,
      lang: f.get("lang") as Lang,
      status: f.get("status") as ReservationStatus,
      reviewed: true,
      source,
      naverBookingId: source === "naver" ? String(f.get("naverBookingId") ?? "").trim() || undefined : undefined,
      customer: {
        name: String(f.get("name") ?? "").trim(),
        ...(contact.includes("@") ? { email: contact } : { phone: contact || undefined }),
      },
      memo: String(f.get("memo") ?? "").trim(),
    };
    setSaving(true);
    setError(null);
    try {
      onDone(await reservationStore.add(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-6 px-6 py-6">
      <fieldset>
        <legend className="field-label mb-2">상품</legend>
        <div className="flex flex-wrap gap-2">
          {RITUALS.map((r) => (
            <Chip key={r.id} name="product" checked={product === r.id} onChange={() => setProduct(r.id)}>
              <span aria-hidden className={`size-2 rounded-full ${r.family === "blue" ? "bg-jjok" : "bg-moss"}`} />
              {RITUAL_FAMILIES[r.family].label} · {r.name}
            </Chip>
          ))}
          <Chip name="product" checked={product === PRIVATE_ID} onChange={() => setProduct(PRIVATE_ID)}>
            <span aria-hidden className="size-2 rounded-full bg-ink" />
            {PRIVATE_CLASS.full}
          </Chip>
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-x-4 gap-y-5">
        <Field label="날짜">
          <input name="date" type="date" required defaultValue={defaultDate} className="field" />
        </Field>
        <Field label="회차(시작)">
          <input name="time" type="time" required step={1800} defaultValue="10:00" className="field" />
        </Field>
        <Field label="인원">
          <input name="people" type="number" min={1} max={20} defaultValue={1} className="field" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Field label="이름">
          <input name="name" required placeholder="김○○" className="field" />
        </Field>
        <Field label="연락처">
          <input name="contact" placeholder="010-0000-0000 또는 이메일" className="field" />
        </Field>
      </div>

      <fieldset>
        <legend className="field-label mb-2">추가 프로그램 (인원 수만큼)</legend>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(ADD_ONS) as AddOnId[]).map((id) => (
            <Field key={id} label={ADD_ONS[id].label}>
              <input name={id} type="number" min={0} max={20} defaultValue={0} className="field" />
              <span className="hint">{ADD_ONS[id].note}</span>
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label mb-2">수령 옵션</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PICKUP) as Pickup[]).map((p) => (
            <Chip key={p} name="pickup" value={p} defaultChecked={p === "onsite"}>
              {PICKUP[p].label}
              {PICKUP[p].price > 0 && <span className="opacity-70">+{PICKUP[p].price / 1000}천</span>}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label mb-2">안내 언어</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
            <Chip key={l} name="lang" value={l} defaultChecked={l === "ko"}>
              {LANG_LABEL[l]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <fieldset>
          <legend className="field-label mb-2">들어온 곳</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["manual", "직접"],
                ["naver", "네이버"],
                ["form", "문의폼"],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} name="source" checked={source === value} onChange={() => setSource(value)}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="field-label mb-2">상태</legend>
          <div className="flex flex-wrap gap-2">
            <Chip name="status" value="confirmed" defaultChecked>
              확정
            </Chip>
            <Chip name="status" value="pending">
              대기
            </Chip>
          </div>
        </fieldset>
      </div>

      {source === "naver" && (
        <Field label="네이버 예약번호">
          <input name="naverBookingId" placeholder="메일·엑셀로 다시 들어올 때 같은 예약으로 묶여요" className="field" />
        </Field>
      )}

      <Field label="메모">
        <textarea name="memo" rows={2} className="field resize-y" />
      </Field>

      <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
        <p className={`mr-auto ${error ? "text-[13px] text-jjok" : "hint"}`}>
          {error ?? "확정으로 넣으면 확정 안내가 대기열에 올라가요."}
        </p>
        <button type="submit" className="btn btn-fill px-6" disabled={saving}>
          {saving ? "저장 중…" : "예약 추가"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  children,
  type = "radio",
  ...input
}: {
  children: ReactNode;
  type?: "radio" | "checkbox";
  name: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] text-ink-2 hover:border-ink-3 has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-jjok">
      <input type={type} className="sr-only" {...input} />
      {children}
    </label>
  );
}
