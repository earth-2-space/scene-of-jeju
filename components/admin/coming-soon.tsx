import type { ReactNode } from "react";
import { PageTop } from "./page-top";

/** 아직 만들지 않은 메뉴 화면: 언제 열리는지와 무엇이 들어올지만 담담하게 */
export function ComingSoon({
  title,
  when,
  children,
}: {
  title: string;
  when: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
      <PageTop title={title} caption={when} />
      <div className="max-w-[560px] rounded-lg border border-dashed border-line px-6 py-6 text-[14px] leading-relaxed text-ink-2">
        {children}
      </div>
    </main>
  );
}
