"use server";

import * as talk from "@/lib/db/talk";
import { TALK_TEXT_MAX, type TalkMessage, type TalkThread } from "@/lib/talk/types";
import { requireAdmin } from "@/lib/session";

/* 문의함(네이버 톡톡) 서버 액션. 로그인 확인 후 lib/db/talk에 넘겨요. */

export type Result<T> = { data: T } | { error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await requireAdmin();
    return { data: await fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "처리하지 못했어요." };
  }
}

export async function listTalkThreadsAction(): Promise<Result<TalkThread[]>> {
  return run(() => talk.listTalkThreads());
}

export async function openTalkThreadAction(userId: string): Promise<Result<TalkMessage[]>> {
  return run(() => talk.openTalkThread(String(userId)));
}

export async function replyTalkAction(userId: string, text: string): Promise<Result<TalkMessage>> {
  const body = String(text ?? "").trim();
  if (!body) return { error: "보낼 내용을 적어 주세요." };
  if (body.length > TALK_TEXT_MAX) return { error: `한 번에 ${TALK_TEXT_MAX.toLocaleString()}자까지 보낼 수 있어요.` };
  return run(() => talk.replyTalk(String(userId), body));
}
