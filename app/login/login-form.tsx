"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="field-label">아이디</span>
        <input
          name="id"
          autoComplete="username"
          required
          className="field"
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="field-label">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </label>

      <p
        role="status"
        aria-live="polite"
        className="-my-1 min-h-5 text-[13px] text-jjok"
      >
        {state.error}
      </p>

      <button type="submit" className="btn btn-fill w-full py-2.5" disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
