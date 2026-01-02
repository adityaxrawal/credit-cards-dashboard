import { BillAlertsRepository } from '../../repositories/BillAlertsRepository';
import logger from '../../utils/infrastructure/logger';

export class BillAlertsService {
    /**
     * Check for overdue bills and upcoming due dates
     */
    static async checkBillAlerts(): Promise<number> {
        let alertCount = 0;
        try {
            // 1. Check Overdue Bills
            const overdueBills = await BillAlertsRepository.getOverdueBillsWithoutAlerts();

            for (const bill of overdueBills) {
                await BillAlertsRepository.createAlert(
                    bill.user_id,
                    'bill_overdue',
                    'high',
                    `Bill Overdue: ${bill.name}`,
                    `You have an overdue bill of ₹${bill.amount} due on ${new Date(bill.due_date).toDateString()}`,
                    { bill_id: bill.id, bill_amount: bill.amount }
                );
                alertCount++;
            }

            // 2. Check Upcoming Bills (Due in 3 days)
            const upcomingBills = await BillAlertsRepository.getUpcomingBillsWithoutAlerts(3);

            for (const bill of upcomingBills) {
                await BillAlertsRepository.createAlert(
                    bill.user_id,
                    'bill_upcoming',
                    'medium',
                    `Upcoming Bill: ${bill.name}`,
                    `Your bill of ₹${bill.amount} is due on ${new Date(bill.due_date).toDateString()}`,
                    { bill_id: bill.id, bill_amount: bill.amount }
                );
                alertCount++;
            }

            return alertCount;
        } catch (error) {
            logger.error('[BillAlerts] Failed to check bill alerts:', error);
            return 0;
        }
    }

    /**
     * Check for upcoming subscription renewals
     */
    static async checkSubscriptionRenewals(): Promise<number> {
        let alertCount = 0;
        try {
            // Check active subscriptions renewing in 2 days
            const renewals = await BillAlertsRepository.getUpcomingSubscriptionRenewals(2);

            for (const sub of renewals) {
                await BillAlertsRepository.createAlert(
                    sub.user_id,
                    'subscription_renewal',
                    'low',
                    `Subscription Renewal: ${sub.merchant_normalized}`,
                    `Your subscription for ${sub.merchant_normalized} (~₹${sub.typical_amount}) is renewing soon on ${new Date(sub.next_expected).toDateString()}`,
                    { subscription_id: sub.id, amount: sub.typical_amount }
                );
                alertCount++;
            }

            return alertCount;
        } catch (error) {
            logger.error('[BillAlerts] Failed to check subscription alerts:', error);
            return 0;
        }
    }
}
