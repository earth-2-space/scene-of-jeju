import "server-only";
import { parseNaverMail, type NaverMail } from "@/lib/naver-mail/parse";
import { cancelNaverBooking, importNaverRows } from "./reservations";
import { db, must } from "./supabase";

/*
 * 네이버 예약 메일 받기(서버 전용). Gmail Apps Script → /api/naver-mail → 여기.
 * 메일마다 naver_mails에 한 줄 남기고, 읽은 예약은 바로 예약 DB에 합쳐요(엑셀과 같은 규칙).
 */

export type IngestResult = { stored: number; duplicate: number; failed: number };

export async function ingestMails(mails: NaverMail[]): Promise<IngestResult> {
  const result: IngestResult = { stored: 0, duplicate: 0, failed: 0 };
  const known = new Set(
    must(
      await db()
        .from("naver_mails")
        .select("mail_id")
        .in("mail_id", mails.map((m) => m.id))
        .returns<{ mail_id: string }[]>(),
    ).map((r) => r.mail_id),
  );

  for (const mail of mails) {
    if (known.has(mail.id)) {
      result.duplicate++;
      continue;
    }
    known.add(mail.id);
    const parsed = parseNaverMail(mail);
    let ok = parsed.ok;
    let reason = parsed.ok ? null : parsed.reason;

    if (parsed.ok) {
      try {
        if (parsed.kind === "cancel") {
          const found = await cancelNaverBooking(parsed.bookingId);
          if (!found && parsed.row) await importNaverRows([parsed.row], "mail");
          if (!found && !parsed.row) {
            ok = false;
            reason = "취소 메일인데 어드민에 없는 예약번호예요";
          }
        } else {
          await importNaverRows([parsed.row], "mail");
        }
      } catch (e) {
        ok = false;
        reason = e instanceof Error ? e.message : "저장하지 못했어요";
      }
    }
    if (!ok) result.failed++;

    must(
      await db().from("naver_mails").insert({
        mail_id: mail.id,
        subject: mail.subject,
        from_addr: mail.from ?? null,
        received_at: mail.receivedAt ?? null,
        kind: parsed.kind,
        ok,
        reason,
        booking_id: parsed.bookingId ?? null,
        raw: mail,
      }),
    );
    result.stored++;
  }
  return result;
}

export type FailedMail = { mailId: string; subject: string; reason: string; receivedAt: string | null };

/** 못 읽은 메일(대표님이 지우기 전까지) */
export async function failedMails(): Promise<FailedMail[]> {
  const rows = must(
    await db()
      .from("naver_mails")
      .select("mail_id, subject, reason, received_at")
      .eq("ok", false)
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<{ mail_id: string; subject: string; reason: string | null; received_at: string | null }[]>(),
  );
  return rows.map((r) => ({ mailId: r.mail_id, subject: r.subject, reason: r.reason ?? "", receivedAt: r.received_at }));
}

export async function dismissFailedMails() {
  must(await db().from("naver_mails").update({ dismissed: true }).eq("ok", false).eq("dismissed", false));
}
