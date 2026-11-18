import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * 서버 전용 Supabase 클라이언트. 비밀 키(secret/service_role)를 쓰니 브라우저로 절대 넘기지 않아요.
 * 테이블은 RLS를 켜 두고 정책이 없어서, 공개 키로는 못 읽어요.
 */

let client: SupabaseClient | null = null;

export class DbNotConfiguredError extends Error {
  constructor() {
    super("Supabase 주소(NEXT_PUBLIC_SUPABASE_URL)와 비밀 키(SUPABASE_SECRET_KEY)를 먼저 넣어 주세요.");
  }
}

export function db(): SupabaseClient {
  if (client) return client;
  // 주소는 공개돼도 되는 값이라 NEXT_PUBLIC_ 이름으로 넣어도 읽어요. 키는 서버 전용 비밀 키만 써요.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DbNotConfiguredError();
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Supabase 응답의 error를 던지고 data만 돌려줘요 */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`DB 오류: ${res.error.message}`);
  return res.data as T;
}
