// 1차 로그인은 "느낌만": 아이디·비밀번호가 환경변수와 맞으면 쿠키 하나를 남겨요.
// Supabase Auth를 붙일 때 이 파일과 proxy.ts만 바꾸면 돼요.
export const SESSION_COOKIE = "soj_admin";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12시간

export const ADMIN_HOME = "/admin/reservations";
