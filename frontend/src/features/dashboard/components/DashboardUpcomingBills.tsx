import { formatCurrency, cn } from "@/shared/utils";
import { Button, Badge } from "@/shared/components/ui";
import Link from "next/link";

interface Bill {
    card_id: string;
    card_name: string;
    bank_name: string;
    days_until_due: number;
    outstanding: number;
}

interface DashboardUpcomingBillsProps {
  bills: Bill[];
}

export function DashboardUpcomingBills({ bills }: DashboardUpcomingBillsProps) {
  if (bills.length === 0) return null;

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-primary-text">Upcoming Bills</h3>
        <Link href="/bills" className="text-xs text-primary-green hover:underline">View All</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bills.map((bill) => (
          <div key={bill.card_id} className="p-4 rounded-lg bg-hover-bg border border-muted-text/5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium text-primary-text">{bill.card_name}</p>
                <p className="text-xs text-secondary-text">{bill.bank_name}</p>
              </div>
              <Badge variant="warning" className="bg-warning/10 text-warning border-0">
                Due in {bill.days_until_due}d
              </Badge>
            </div>
            <div className="flex justify-between items-end mt-4">
              <div>
                <p className="text-xs text-secondary-text">Amount Due</p>
                <p className="text-lg font-bold text-primary-text">{formatCurrency(bill.outstanding)}</p>
              </div>
              <Button size="sm" variant="secondary">Pay Now</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
