"use client";

import { useEffect, useState } from "react";
import { unreadTalkCountAction } from "@/app/admin/inbox/actions";
import { TALK_UNREAD_EVENT } from "./types";

/*
 * 왼쪽 메뉴 "문의함" 뱃지: 안 읽은 톡톡 대화 수.
 * 1분마다, 창으로 돌아올 때, 문의함에서 대화를 열었을 때 다시 읽어요.
 */

const INTERVAL = 60_000;

export function useTalkUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    let running = false;

    async function check() {
      if (running || document.hidden) return;
      running = true;
      try {
        const res = await unreadTalkCountAction();
        if (alive && "data" in res) setCount(res.data);
      } finally {
        running = false;
      }
    }

    void check();
    const id = setInterval(check, INTERVAL);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(TALK_UNREAD_EVENT, check);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(TALK_UNREAD_EVENT, check);
    };
  }, []);

  return count;
}
