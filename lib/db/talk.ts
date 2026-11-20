import "server-only";
import { readContent, type TalkEvent, type TalkMessage, type TalkSender, type TalkThread } from "@/lib/talk/types";
import { sendTalkText } from "@/lib/talk/send";
import { db, must } from "./supabase";

/*
 * 네이버 톡톡 문의(서버 전용). 톡톡 webhook → /api/naver-talk → recordTalkEvent.
 * 어드민 답장은 먼저 DB에 적고 보내요. 보낸 답장이 echo로 다시 오면 같은 글이라 한 번만 남겨요.
 */

const ECHO_WINDOW_MS = 2 * 60_000;

type ThreadRow = {
  user_id: string;
  inflow: string | null;
  referer: string | null;
  last_text: string | null;
  last_at: string | null;
  unread: number;
  left_at: string | null;
  memo: string;
};

type MessageRow = {
  id: string;
  user_id: string;
  direction: "in" | "out";
  sender: TalkSender;
  kind: TalkMessage["kind"];
  text: string | null;
  image_url: string | null;
  created_at: string;
};

const toThread = (r: ThreadRow): TalkThread => ({
  userId: r.user_id,
  inflow: r.inflow ?? undefined,
  referer: r.referer ?? undefined,
  lastText: r.last_text ?? undefined,
  lastAt: r.last_at ?? undefined,
  unread: r.unread,
  leftAt: r.left_at ?? undefined,
  memo: r.memo,
});

const toMessage = (r: MessageRow): TalkMessage => ({
  id: r.id,
  userId: r.user_id,
  direction: r.direction,
  sender: r.sender,
  kind: r.kind,
  text: r.text ?? undefined,
  imageUrl: r.image_url ?? undefined,
  createdAt: r.created_at,
});

const opt = <T>(e: TalkEvent, key: string) => e.options?.[key] as T | undefined;

type ThreadPatch = Partial<Omit<ThreadRow, "user_id">> & { under14?: boolean | null; friend?: boolean | null };

async function ensureThread(userId: string, patch: ThreadPatch = {}) {
  must(
    await db()
      .from("talk_threads")
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
  );
}

async function bumpThread(userId: string, preview: string, at: string, unreadDelta: number) {
  const current = must(
    await db().from("talk_threads").select("unread").eq("user_id", userId).maybeSingle<{ unread: number }>(),
  );
  await ensureThread(userId, {
    last_text: preview.slice(0, 200),
    last_at: at,
    unread: (current?.unread ?? 0) + unreadDelta,
    ...(unreadDelta > 0 ? { left_at: null } : {}),
  });
}

async function insertMessage(e: TalkEvent, userId: string, direction: "in" | "out", sender: TalkSender) {
  const c = readContent(e);
  const at = new Date().toISOString();
  must(
    await db().from("talk_messages").insert({
      user_id: userId,
      direction,
      sender,
      kind: c.kind,
      text: c.text ?? null,
      image_url: c.imageUrl ?? null,
      raw: e,
      created_at: at,
    }),
  );
  await bumpThread(userId, c.preview, at, direction === "in" ? 1 : 0);
}

/** 어드민이 보낸 답장이 echo로 돌아온 것인지 */
async function isOwnEcho(userId: string, text: string | undefined) {
  if (!text) return false;
  const since = new Date(Date.now() - ECHO_WINDOW_MS).toISOString();
  const rows = must(
    await db()
      .from("talk_messages")
      .select("id")
      .eq("user_id", userId)
      .eq("sender", "admin")
      .eq("text", text)
      .gte("created_at", since)
      .limit(1),
  );
  return rows.length > 0;
}

/** webhook 이벤트 한 건을 기록해요. 자동 답장은 하지 않아요. */
export async function recordTalkEvent(e: TalkEvent): Promise<void> {
  const userId = e.user;
  if (!userId) return;

  switch (e.event) {
    case "open": {
      const existing = must(
        await db().from("talk_threads").select("user_id").eq("user_id", userId).maybeSingle(),
      );
      // 처음 들어온 경로만 남겨요(다시 열 때마다 덮지 않아요).
      await ensureThread(userId, {
        ...(existing ? {} : { inflow: opt<string>(e, "inflow") ?? null, referer: opt<string>(e, "referer") ?? null }),
        under14: opt<boolean>(e, "under14") ?? null,
        friend: opt<boolean>(e, "friend") ?? null,
      });
      return;
    }
    case "leave":
      await ensureThread(userId, { left_at: new Date().toISOString() });
      return;
    case "friend":
      await ensureThread(userId, { friend: opt<string>(e, "set") === "on" });
      return;
    case "send":
      await ensureThread(userId);
      await insertMessage(e, userId, "in", "customer");
      return;
    case "echo": {
      if (e.echoedEvent && e.echoedEvent !== "send") return;
      await ensureThread(userId);
      if (await isOwnEcho(userId, readContent(e).text)) return;
      // 파트너센터(앱·웹)에서 직접 보낸 답장도 대화에 남겨요.
      await insertMessage(e, userId, "out", "partner_center");
      return;
    }
    default:
      // handover·action·profile 등은 지금 쓰지 않아요.
      return;
  }
}

export async function listTalkThreads(): Promise<TalkThread[]> {
  const rows = must(
    await db()
      .from("talk_threads")
      .select("user_id, inflow, referer, last_text, last_at, unread, left_at, memo")
      .not("last_at", "is", null)
      .order("last_at", { ascending: false })
      .limit(200)
      .returns<ThreadRow[]>(),
  );
  return rows.map(toThread);
}

/** 왼쪽 메뉴 뱃지: 안 읽은 손님 메시지가 있는 대화 수 */
export async function unreadTalkCount(): Promise<number> {
  const { count, error } = await db()
    .from("talk_threads")
    .select("user_id", { count: "exact", head: true })
    .gt("unread", 0);
  if (error) throw new Error(`DB 오류: ${error.message}`);
  return count ?? 0;
}

/** 대화 열기: 메시지를 읽고 안 읽음 수를 비워요 */
export async function openTalkThread(userId: string): Promise<TalkMessage[]> {
  const rows = must(
    await db()
      .from("talk_messages")
      .select("id, user_id, direction, sender, kind, text, image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<MessageRow[]>(),
  );
  must(await db().from("talk_threads").update({ unread: 0 }).eq("user_id", userId));
  return rows.map(toMessage);
}

/** 어드민 답장: 먼저 적고 보내요. 못 보내면 지워요. */
export async function replyTalk(userId: string, text: string): Promise<TalkMessage> {
  const row = must(
    await db()
      .from("talk_messages")
      .insert({
        user_id: userId,
        direction: "out",
        sender: "admin",
        kind: "text",
        text,
        raw: { event: "send", user: userId, textContent: { text } },
      })
      .select("id, user_id, direction, sender, kind, text, image_url, created_at")
      .single<MessageRow>(),
  );
  try {
    await sendTalkText(userId, text);
  } catch (e) {
    await db().from("talk_messages").delete().eq("id", row.id);
    throw e;
  }
  await bumpThread(userId, text, row.created_at, 0);
  return toMessage(row);
}
