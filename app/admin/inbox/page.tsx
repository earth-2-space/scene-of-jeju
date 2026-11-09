import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "문의함 · 씬오브제주 어드민" };

export default function InboxPage() {
  return (
    <ComingSoon title="문의함" when="영문 예약 폼과 함께 열려요">
      <p>
        네이버·카카오 계정이 없는 외국인 손님이 영문 폼으로 남긴 문의가 여기로 들어와요. 날짜를 정해 확정하면 예약
        보드에 한 줄 생기고, 안내는 이메일로 나가요.
      </p>
      <p className="mt-3 text-ink-3">지금은 예약 보드에서 “문의” 상태로 직접 넣어 둘 수 있어요.</p>
    </ComingSoon>
  );
}
