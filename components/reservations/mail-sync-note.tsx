"use client";

import { useNaverMailSync } from "@/lib/naver-mail/use-sync";

/** 보드 위 한 줄: 네이버 예약 메일을 언제 확인했고, 읽지 못한 메일이 있는지 */
export function MailSyncNote() {
  const sync = useNaverMailSync();
  if (!sync.checkedAt) return null;

  const time = sync.checkedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
      <span>
        네이버 예약 메일 · {time} 확인
      </span>
      {sync.failed.length > 0 && (
        <details className="text-ink-2">
          <summary className="cursor-pointer">읽지 못한 메일 {sync.failed.length}건</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {sync.failed.map((f) => (
              <li key={f.mailId}>
                {f.subject || "(제목 없음)"} — {f.reason}
              </li>
            ))}
          </ul>
          <p className="mt-1">스마트플레이스에서 직접 확인한 뒤 지워 주세요.</p>
          <button type="button" className="mt-1 underline" onClick={sync.dismissFailed}>
            목록 지우기
          </button>
        </details>
      )}
    </div>
  );
}
