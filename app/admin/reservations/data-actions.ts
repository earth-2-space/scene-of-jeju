"use server";

import * as reservations from "@/lib/db/reservations";
import * as mails from "@/lib/db/naver-mails";
import type { Reservation, ReservationInput, ReservationStatus } from "@/lib/reservations/types";
import { requireAdmin } from "@/lib/session";

/*
 * 예약 화면이 부르는 서버 액션. 로그인을 확인한 뒤 lib/db에 넘기기만 해요.
 * 실패해도 화면이 알 수 있게 { error }로 돌려줘요(배포 환경에선 던진 오류 문구가 가려져요).
 */

export type Result<T> = { data: T } | { error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await requireAdmin();
    return { data: await fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "저장하지 못했어요." };
  }
}

export async function listReservationsAction(): Promise<Result<Reservation[]>> {
  return run(() => reservations.listReservations());
}

export async function addReservationAction(input: ReservationInput): Promise<Result<Reservation>> {
  return run(() => reservations.addReservation(input));
}

export async function setStatusAction(id: string, status: ReservationStatus): Promise<Result<Reservation>> {
  return run(() => reservations.setReservationStatus(id, status));
}

export async function reviewAction(id: string): Promise<Result<Reservation>> {
  return run(() => reservations.reviewReservation(id));
}

export async function updateReservationAction(
  id: string,
  patch: Partial<Pick<Reservation, "memo" | "ritualId">>,
): Promise<Result<Reservation>> {
  // 고칠 수 있는 칸만 골라서 넘겨요(빠진 칸은 그대로 둬요).
  const safe: Partial<Pick<Reservation, "memo" | "ritualId">> = {};
  if (typeof patch.memo === "string") safe.memo = patch.memo;
  if ("ritualId" in patch) safe.ritualId = typeof patch.ritualId === "string" ? patch.ritualId : null;
  return run(() => reservations.updateReservation(id, safe));
}

export async function importNaverAction(rows: ReservationInput[]): Promise<Result<reservations.ImportResult>> {
  return run(() => reservations.importNaverRows(rows, "excel"));
}

export async function failedMailsAction(): Promise<Result<mails.FailedMail[]>> {
  return run(() => mails.failedMails());
}

export async function dismissFailedMailsAction(): Promise<Result<void>> {
  return run(() => mails.dismissFailedMails());
}
