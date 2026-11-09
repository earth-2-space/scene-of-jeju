// 어드민 메뉴(브리프 4장). 1차에 넣지 않는 항목은 "준비 중"으로 흐리게 자리만 둬요.
export const ADMIN_NAV = [
  { href: "/admin/reservations", label: "예약" },
  { href: "/admin/records", label: "탄생 기록" },
  { href: "/admin/messages", label: "안내 발송" },
  { href: "/admin/inbox", label: "문의함" },
] as const;

export const ADMIN_NAV_LATER = ["재료·도구", "지표"] as const;
