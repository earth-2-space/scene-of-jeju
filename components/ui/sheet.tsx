"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 오른쪽에서 열리는 패널. 네이티브 <dialog>라 포커스 가두기·Esc 닫기가 기본으로 돼요.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-0 ml-auto h-dvh max-h-dvh w-full max-w-full border-l border-line bg-paper p-0 text-ink shadow-[-12px_0_32px_-24px_rgb(38_37_33/0.4)] ${
        wide ? "sm:max-w-[640px]" : "sm:max-w-[480px]"
      }`}
    >
      {open && <div className="flex min-h-full flex-col">{children}</div>}
    </dialog>
  );
}

export function SheetHeader({
  title,
  sub,
  onClose,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-4 border-b border-line px-6 pt-5 pb-4">
      <div className="min-w-0">
        <h2 className="text-[18px] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-ink-3">{sub}</p>}
      </div>
      <button type="button" onClick={onClose} className="btn ml-auto shrink-0 px-2.5 py-1">
        닫기
      </button>
    </div>
  );
}

/** 패널 안의 한 덩어리: 작은 제목 + 내용 */
export function SheetSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {aside && <span className="hint">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
