import type { Metadata } from "next";
import AccountsClient from "./AccountsClient";

export const metadata: Metadata = {
  title: "Accounts | Financial Tracker",
  description: "Manage your bank accounts, wallets, and cash holdings.",
};

export default function AccountsPage() {
  return <AccountsClient />;
}
