import type { Metadata } from "next";
import { ReservationBoard } from "@/components/reservations/board";

export const metadata: Metadata = { title: "예약 · 씬오브제주 어드민" };

export default function ReservationsPage() {
  return <ReservationBoard />;
}
