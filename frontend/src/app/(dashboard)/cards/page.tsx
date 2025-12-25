import type { Metadata } from "next";
import CardsPageClient from "@/components/features/cards/CardsPageClient";

export const metadata: Metadata = {
  title: "Cards | Credit Card Dashboard",
  description: "Manage your credit cards, view limits, and track due dates.",
};

export default function CardsPage() {
  return <CardsPageClient />;
}
