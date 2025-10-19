import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CreditCardComponent from "@/components/dashboard/credit-card";
import Transactions from "@/components/dashboard/transactions";
import Perks from "@/components/dashboard/perks";

export default async function CardDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ await the promise

  const supabase = await createClient();

  const { data: card } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("id", id)
    .single();

  if (!card) {
    notFound();
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("card_id", id);

  const { data: cards } = await supabase.from("credit_cards").select("*");

  return (
    <div className="space-y-8">
      <div>
        <CreditCardComponent card={card} />
      </div>
      <div className="mt-8">
        <Perks />
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Transactions</h2>
        <Transactions transactions={transactions || []} cards={cards || []} />
      </div>
    </div>
  );
}