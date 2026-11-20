import type { ReactNode } from "react";

/** 화면 맨 위: 제목 + 한 줄 설명 + 오른쪽 버튼들 */
export function PageTop({
  title,
  caption,
  actions,
}: {
  title: ReactNode;
  caption?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-serif text-[34px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {caption && <p className="mt-1 text-[14px] text-ink-2">{caption}</p>}
      </div>
      {actions && <div className="flex gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}
