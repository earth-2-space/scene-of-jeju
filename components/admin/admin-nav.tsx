"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, ADMIN_NAV_LATER } from "@/lib/admin-nav";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="어드민 메뉴"
      className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible"
    >
      {ADMIN_NAV.map((item) => {
        const on = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-[14px] whitespace-nowrap ${
              on ? "bg-sheet-2 font-semibold text-ink" : "text-ink-2 hover:bg-sheet hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}

      <div className="mt-4 mb-1 hidden px-2.5 text-[11px] text-ink-3 lg:block">준비 중</div>
      {ADMIN_NAV_LATER.map((label) => (
        <span
          key={label}
          aria-disabled="true"
          title="2차에 열려요"
          className="hidden px-2.5 py-1.5 text-[14px] text-ink-3 opacity-70 lg:block"
        >
          {label}
        </span>
      ))}
    </nav>
  );
}
