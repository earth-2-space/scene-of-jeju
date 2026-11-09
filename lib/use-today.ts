"use client";

import { useSyncExternalStore } from "react";
import { toISODate } from "./dates";

// 오늘 날짜는 브라우저 시계로 정해요(서버 렌더링 땐 null).
// 분 단위로 다시 읽어서 자정을 넘기면 화면도 다음 날로 넘어가요.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

export function useToday(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => toISODate(new Date()),
    () => null,
  );
}
