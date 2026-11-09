import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "탄생 기록 · 씬오브제주 어드민" };

export default function RecordsPage() {
  return (
    <ComingSoon title="탄생 기록" when="W4(11.23–11.27)에 열려요">
      <p>
        방문한 예약에서 바로 이어서 적어요. 번호(<span className="font-medium">S-YYMM-NNN</span>)와 탄생일, 그날의
        날씨는 자동으로 채워지고, 저장하면 A5 카드로 출력돼요.
      </p>
      <p className="mt-3 text-ink-3">기록이 SCENES에 걸리면 손님께 “장면이 걸렸어요” 안내가 나가요.</p>
    </ComingSoon>
  );
}
