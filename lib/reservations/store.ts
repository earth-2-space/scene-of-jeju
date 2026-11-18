"use client";

import { useSyncExternalStore } from "react";
import {
  addReservationAction,
  importNaverAction,
  listReservationsAction,
  reviewAction,
  setStatusAction,
  updateReservationAction,
  type Result,
} from "@/app/admin/reservations/data-actions";
import type { Reservation, ReservationInput, ReservationStatus } from "./types";

/*
 * 예약 저장소(브라우저 쪽).
 * 예약은 Supabase에 있고, 여기는 화면이 같이 보는 사본(캐시)만 들고 있어요.
 * 바꿀 때는 서버 액션으로 DB에 쓰고, 돌아온 예약으로 사본을 갈아 끼워요.
 * 네이버 메일로 들어온 예약은 서버가 바로 DB에 넣으니 refresh()로 다시 읽어요.
 */

export type StoreState = { reservations: Reservation[] | null; error: string | null };

let state: StoreState = { reservations: null, error: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<StoreState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (state.reservations === null && !loading) void reservationStore.refresh();
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const SERVER_SNAPSHOT: StoreState = { reservations: null, error: null };

export function useReservationStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/** 서버 렌더링 땐, 그리고 처음 불러오는 동안엔 비어 있어요(null). */
export function useReservations(): Reservation[] | null {
  return useReservationStore().reservations;
}

function unwrap<T>(res: Result<T>): T {
  if ("error" in res) {
    emit({ error: res.error });
    throw new Error(res.error);
  }
  return res.data;
}

function replace(r: Reservation) {
  const list = state.reservations ?? [];
  const exists = list.some((x) => x.id === r.id);
  emit({ reservations: exists ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r], error: null });
  return r;
}

async function settle(p: Promise<Result<Reservation>>) {
  try {
    const res = await p;
    if ("error" in res) emit({ error: res.error });
    else replace(res.data);
  } catch {
    emit({ error: "저장하지 못했어요. 잠시 뒤 다시 해 주세요." });
  }
}

export type ImportResult = { added: number; updated: number };

export const reservationStore = {
  refresh(): Promise<void> {
    loading ??= listReservationsAction()
      .then((res) => {
        if ("error" in res) emit({ error: res.error, reservations: state.reservations ?? [] });
        else emit({ reservations: res.data, error: null });
      })
      .catch(() => emit({ error: "예약을 불러오지 못했어요.", reservations: state.reservations ?? [] }))
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  async add(input: ReservationInput): Promise<Reservation> {
    return replace(unwrap(await addReservationAction(input)));
  },

  // 아래 셋은 버튼에서 바로 불러요. 실패하면 던지지 않고 보드 위 알림(error)으로 보여줘요.
  async setStatus(id: string, status: ReservationStatus) {
    await settle(setStatusAction(id, status));
  },

  /** 네이버 바로확정 예약을 대표님이 확인: 이때 카카오 확정 안내·리마인드가 잡혀요. */
  async review(id: string) {
    await settle(reviewAction(id));
  },

  async update(id: string, patch: Partial<Pick<Reservation, "memo" | "ritualId">>) {
    await settle(updateReservationAction(id, patch));
  },

  /** 네이버 예약번호가 같으면 갱신, 없으면 새로 넣어요. 메모·발송 내역은 지켜요. */
  async importNaver(rows: ReservationInput[]): Promise<ImportResult> {
    const result = unwrap(await importNaverAction(rows));
    await reservationStore.refresh();
    return result;
  },

  clearError() {
    emit({ error: null });
  },
};
