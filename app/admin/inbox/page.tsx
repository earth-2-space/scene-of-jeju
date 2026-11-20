import type { Metadata } from "next";
import { TalkInbox } from "@/components/inbox/talk-inbox";

export const metadata: Metadata = { title: "문의함 · 씬오브제주 어드민" };

export default function InboxPage() {
  return <TalkInbox />;
}
