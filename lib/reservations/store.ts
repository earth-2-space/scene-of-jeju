"use client";

import { useSyncExternalStore } from "react";
import { nowLocal } from "@/lib/dates";
import { planMessages } from "@/lib/messages/triggers";
import { seedReservations } from "./seed";
import type { Reservation, ReservationInput, ReservationStatus } from "./types";

/*
 * 예약 저장소.
 * 이번 주 시안은 DB 연결 전이라 브라우저(localStorage)에 저장해요.
 * 화면은 아래 reservationStore / useReservations만 쓰니까,
 * Supabase를 붙일 때는 이 파일 안쪽만 바꾸면 돼요.
 */

const STORAGE_KEY = "soj.reservations.v3";

let state: Reservation[] | null = null;
const listeners = new Set<() => void>();

function load(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Reservation[];
  } catch {
    // 저장소를 못 읽으면 예시 데이터로 시작해요.
  }
  return seedReservations();
}

function commit(next: Reservation[]) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 비공개 창 등에서 저장이 막혀도 화면은 계속 써요.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (state === null) state = load();
  return state;
}

/** 서버 렌더링 땐 비어 있고(null), 브라우저에서 채워져요. */
function getServerSnapshot() {
  return null;
}

export function useReservations(): Reservation[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const newId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 어드민에서 상태를 바꾸면 "확인한 것"으로 보고, 확인한 예약만 안내를 잡아요. */
function withStatus(r: Reservation, status: ReservationStatus, now: string): Reservation {
  if (r.status === status && r.reviewed) return r;
  const reviewed = { ...r, reviewed: true };
  return { ...reviewed, status, messages: planMessages(reviewed, status, now), updatedAt: now };
}

export type ImportResult = { added: number; updated: number };

export const reservationStore = {
  add(input: ReservationInput): Reservation {
    const now = nowLocal();
    const draft: Reservation = { ...input, id: newId(), messages: [], createdAt: now, updatedAt: now };
    // 직접 넣은 예약은 확인한 것으로 봐요. 처음부터 "확정"이면 확정 안내도 바로 대기열에 올라가요.
    const created: Reservation = draft.reviewed
      ? { ...draft, messages: planMessages(draft, draft.status, now) }
      : draft;
    commit([...getSnapshot(), created]);
    return created;
  },

  setStatus(id: string, status: ReservationStatus) {
    const now = nowLocal();
    commit(getSnapshot().map((r) => (r.id === id ? withStatus(r, status, now) : r)));
  },

  /** 네이버 바로확정 예약을 대표님이 확인: 이때 카카오 확정 안내·리마인드가 잡혀요. */
  review(id: string) {
    const now = nowLocal();
    commit(getSnapshot().map((r) => (r.id === id ? withStatus(r, r.status, now) : r)));
  },

  update(id: string, patch: Partial<Pick<Reservation, "memo" | "ritualId">>) {
    const now = nowLocal();
    commit(getSnapshot().map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now } : r)));
  },

  /** 네이버 예약번호가 같으면 덮어쓰고(갱신), 없으면 새로 넣어요. 메모·발송 내역은 지켜요. */
  importNaver(rows: ReservationInput[]): ImportResult {
    const now = nowLocal();
    const current = [...getSnapshot()];
    let added = 0;
    let updated = 0;

    for (const row of rows) {
      const idx = current.findIndex((r) => r.naverBookingId && r.naverBookingId === row.naverBookingId);
      if (idx === -1) {
        current.push({ ...row, id: newId(), messages: [], createdAt: now, updatedAt: now });
        added++;
        continue;
      }
      const prev = current[idx];
      const merged: Reservation = {
        ...prev,
        ...row,
        status: prev.status,
        reviewed: prev.reviewed,
        ritualId: prev.ritualId ?? row.ritualId,
        memo: prev.memo || row.memo,
        updatedAt: now,
      };
      // 네이버에서 취소된 건만 상태를 따라가요(남은 안내도 멈춰요). 나머지 상태는 어드민에서 정해요.
      current[idx] = row.status === "canceled" ? withStatus(merged, "canceled", now) : merged;
      updated++;
    }

    commit(current);
    return { added, updated };
  },

  resetToSample() {
    commit(seedReservations());
  },
};
