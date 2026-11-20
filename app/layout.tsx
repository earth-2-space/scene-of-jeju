import type { Metadata } from "next";
import { Noto_Serif_KR } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 제목 전용 세리프. 한글 글리프는 쓰는 글자 조각만 받아오도록 미리 불러오지 않아요.
const serif = Noto_Serif_KR({
  weight: ["600"],
  subsets: ["latin"],
  preload: false,
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "씬오브제주 어드민",
  description: "예약부터 탄생 기록, 안내까지 한 바퀴",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${serif.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
