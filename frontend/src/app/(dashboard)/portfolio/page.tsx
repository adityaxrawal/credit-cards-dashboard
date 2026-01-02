import { redirect } from "next/navigation";

export default function PortfolioPage() {
  // Default to accounts until Net Worth view is ready
  redirect("/portfolio/accounts");
}
