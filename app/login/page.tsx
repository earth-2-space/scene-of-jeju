import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 · 씬오브제주 어드민" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-sheet px-4 py-16">
      <div className="w-full max-w-[360px] rounded-lg border border-line bg-paper px-7 pt-7 pb-8">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Scene of Jeju</h1>
        <p className="mt-0.5 mb-7 text-[13px] text-ink-3">어드민에 로그인해 주세요.</p>
        <LoginForm />
      </div>
    </main>
  );
}
