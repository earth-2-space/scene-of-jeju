"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_HOME, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { createSessionValue } from "@/lib/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const expectedId = process.env.ADMIN_ID;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedId || !expectedPassword) {
    return { error: "ADMIN_ID, ADMIN_PASSWORD 환경변수를 먼저 설정해 주세요." };
  }
  if (!id || !password) {
    return { error: "아이디와 비밀번호를 적어 주세요." };
  }
  if (id !== expectedId || password !== expectedPassword) {
    return { error: "아이디나 비밀번호가 달라요." };
  }

  (await cookies()).set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(ADMIN_HOME);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
