import type { Metadata } from "next";
import DashboardClient from "@/components/features/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Overview | Credit Card Dashboard",
  description: "Your financial overview at a glance.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
