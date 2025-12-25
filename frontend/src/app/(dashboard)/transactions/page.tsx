import type { Metadata } from "next";
import TransactionsPageClient from "@/components/features/transactions/TransactionsPageClient";

export const metadata: Metadata = {
  title: "Transactions | Credit Card Dashboard",
  description: "View and filter your credit card transactions.",
};

export default function TransactionsPage() {
  return <TransactionsPageClient />;
}
