import type { Metadata } from "next";
import GoalsClient from "./GoalsClient";

export const metadata: Metadata = {
  title: "Goals | Financial Tracker",
  description: "Track your savings goals and sinking funds.",
};

export default function GoalsPage() {
  return <GoalsClient />;
}
