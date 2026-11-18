"use client";

import { useEffect, useState } from "react";
import {
  dismissFailedMailsAction,
  failedMailsAction,
} from "@/app/admin/reservations/data-actions";
import type { FailedMail } from "@/lib/db/naver-mails";
import { reservationStore } from "@/lib/reservations/store";

/*
 * 네이버 예약 메일은 서버(/api/naver-mail)가 받아서 바로 DB에 넣어요.
 * 어드민 화면은 5분마다(그리고 창으로 돌아올 때) 예약과 못 읽은 메일을 다시 읽어요.
 */

const INTERVAL = 5 * 60_000;

export type { FailedMail };

export type NaverMailSync = {
  checkedAt: Date | null;
  failed: FailedMail[];
  /** 못 읽은 메일 목록을 비워요(대표님이 스마트플레이스에서 직접 확인했을 때) */
  dismissFailed: () => void;
};

// 화면이 두 번 붙어도(개발 모드 등) 확인은 한 번에 하나만 돌아요.
let running = false;

export function useNaverMailSync(): NaverMailSync {
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState<FailedMail[]>([]);

  useEffect(() => {
    let alive = true;

    async function check() {
      if (running) return;
      running = true;
      try {
        const [, res] = await Promise.all([reservationStore.refresh(), failedMailsAction()]);
        if (!alive) return;
        if ("data" in res) setFailed(res.data);
        setCheckedAt(new Date());
      } catch {
        // 오류는 예약 저장소가 보드 위에 보여줘요.
      } finally {
        running = false;
      }
    }

    // 첫 목록은 저장소가 불러오니, 처음엔 못 읽은 메일만 확인해요.
    failedMailsAction()
      .then((res) => {
        if (!alive) return;
        if ("data" in res) setFailed(res.data);
        setCheckedAt(new Date());
      })
      .catch(() => undefined);
    const id = setInterval(check, INTERVAL);
    const onFocus = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return {
    checkedAt,
    failed,
    dismissFailed: () => {
      setFailed([]);
      void dismissFailedMailsAction();
    },
  };
}
