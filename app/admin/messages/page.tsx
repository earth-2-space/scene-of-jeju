import type { Metadata } from "next";
import { MessagesOverview } from "@/components/messages/overview";

export const metadata: Metadata = { title: "안내 발송 · 씬오브제주 어드민" };

export default function MessagesPage() {
  return <MessagesOverview />;
}
