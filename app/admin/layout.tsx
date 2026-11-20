import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { SidebarToday } from "@/components/admin/sidebar-today";
import { ADMIN_HOME } from "@/lib/auth";
import { logout } from "../login/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[200px_1fr]">
      <aside className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-paper px-4 pt-3 pb-2 lg:h-dvh lg:gap-6 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-5">
        <div className="flex items-center justify-between lg:px-2">
          <Link href={ADMIN_HOME} className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Scene of Jeju</span>
            <span className="text-[13px] text-ink-3">어드민</span>
          </Link>
          <form action={logout} className="lg:hidden">
            <button type="submit" className="text-[13px] text-ink-3 hover:text-ink">
              로그아웃
            </button>
          </form>
        </div>

        <AdminNav />

        <div className="mt-auto hidden flex-col gap-3 border-t border-line-2 px-2 pt-4 lg:flex">
          <SidebarToday />
          <form action={logout}>
            <button type="submit" className="text-[13px] text-ink-3 hover:text-ink">
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
