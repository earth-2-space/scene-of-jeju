"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listTalkThreadsAction, openTalkThreadAction, replyTalkAction } from "@/app/admin/inbox/actions";
import { PageTop } from "@/components/admin/page-top";
import { TALK_SENDER_LABEL, type TalkMessage, type TalkThread } from "@/lib/talk/types";

/*
 * 문의함: 네이버 톡톡 대화. 30초마다(그리고 창으로 돌아올 때) 다시 읽어요.
 * 손님은 톡톡 익명 식별값으로만 와서 이름 대신 "손님 ·끝 6자리"로 보여줘요.
 */

const INTERVAL = 30_000;

const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const guestName = (userId: string) => `손님 · ${userId.slice(-6)}`;

export function TalkInbox() {
  const [threads, setThreads] = useState<TalkThread[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await listTalkThreadsAction();
    if ("error" in res) setError(res.error);
    else setThreads(res.data);
  }, []);

  const loadMessages = useCallback(async (userId: string) => {
    const res = await openTalkThreadAction(userId);
    if ("error" in res) setError(res.error);
    else {
      setMessages(res.data);
      setThreads((ts) => ts?.map((t) => (t.userId === userId ? { ...t, unread: 0 } : t)) ?? ts);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive || document.hidden) return;
      void loadThreads();
      if (openId) void loadMessages(openId);
    };
    tick();
    const id = setInterval(tick, INTERVAL);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [openId, loadThreads, loadMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, openId]);

  async function send() {
    if (!openId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await replyTalkAction(openId, draft);
    setSending(false);
    if ("error" in res) return setError(res.error);
    setDraft("");
    setMessages((ms) => [...ms, res.data]);
    void loadThreads();
  }

  const open = threads?.find((t) => t.userId === openId);

  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
      <PageTop title="문의함" caption="네이버 톡톡으로 온 문의 · 여기서 답하면 손님 톡톡으로 가요" />

      {error && (
        <p role="alert" className="rounded-md border border-line bg-sheet px-3 py-2 text-[13px] text-ink-2">
          {error}
        </p>
      )}

      <div className="grid min-h-[480px] gap-4 md:grid-cols-[280px_1fr]">
        <nav aria-label="대화 목록" className={`flex flex-col gap-1 ${openId ? "max-md:hidden" : ""}`}>
          {threads === null && <p className="text-[13px] text-ink-3">불러오는 중…</p>}
          {threads?.length === 0 && (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-[14px] text-ink-2">
              아직 받은 톡톡 문의가 없어요.
            </p>
          )}
          {threads?.map((t) => (
            <button
              key={t.userId}
              type="button"
              onClick={() => {
                setOpenId(t.userId);
                setMessages([]);
              }}
              aria-current={t.userId === openId}
              className="flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-sheet aria-[current=true]:bg-sheet-2"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold">{guestName(t.userId)}</span>
                <span className="shrink-0 text-[12px] text-ink-3">{when(t.lastAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{t.lastText}</span>
                {t.unread > 0 && (
                  <span className="rounded-full bg-jjok px-1.5 text-[11px] leading-[18px] font-semibold text-paper">
                    {t.unread}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        <section
          aria-label="대화"
          className={`flex min-h-[480px] flex-col rounded-lg border border-line ${openId ? "" : "max-md:hidden"}`}
        >
          {!open ? (
            <p className="m-auto px-6 text-[14px] text-ink-3">왼쪽에서 대화를 골라 주세요.</p>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button type="button" className="text-[13px] text-ink-2 underline md:hidden" onClick={() => setOpenId(null)}>
                  목록
                </button>
                <h2 className="text-[15px] font-semibold">{guestName(open.userId)}</h2>
                {open.leftAt && <span className="text-[12px] text-ink-3">채팅방을 나갔어요</span>}
              </header>

              <ol className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
                {messages.map((m) => (
                  <li key={m.id} className={`flex max-w-[80%] flex-col gap-0.5 ${m.direction === "out" ? "self-end items-end" : "self-start"}`}>
                    <div
                      className={`rounded-lg px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                        m.direction === "out" ? "bg-ink text-paper" : "bg-sheet-2"
                      }`}
                    >
                      {m.kind === "image" && m.imageUrl ? (
                        <a href={m.imageUrl} target="_blank" rel="noreferrer" className="underline">
                          사진 보기
                        </a>
                      ) : (
                        (m.text ?? (m.kind === "composite" ? "(카드 메시지)" : "(메시지)"))
                      )}
                    </div>
                    <span className="text-[11px] text-ink-3">
                      {m.direction === "out" ? `${TALK_SENDER_LABEL[m.sender]} · ` : ""}
                      {when(m.createdAt)}
                    </span>
                  </li>
                ))}
                <div ref={bottom} />
              </ol>

              <form
                className="flex items-end gap-2 border-t border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <label className="sr-only" htmlFor="talk-reply">
                  답장
                </label>
                <textarea
                  id="talk-reply"
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
                  }}
                  placeholder="답장 (⌘+Enter로 보내기)"
                  className="min-w-0 flex-1 resize-y rounded-md border border-line px-3 py-2 text-[14px] focus-visible:outline-2 focus-visible:outline-jjok"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="rounded-md bg-ink px-4 py-2 text-[14px] font-semibold text-paper disabled:opacity-40"
                >
                  {sending ? "보내는 중" : "보내기"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
