import type { Metadata } from "next";
import LoansClient from "./LoansClient";

export const metadata: Metadata = {
  title: "Loans | Financial Tracker",
  description: "Track your loans, EMIs, and repayment progress.",
};

export default function LoansPage() {
  return <LoansClient />;
}
