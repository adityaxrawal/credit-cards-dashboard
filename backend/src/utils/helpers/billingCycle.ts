import dayjs from 'dayjs';

export interface BillingPeriod {
  start: Date;
  end: Date;
  billDate: Date;
  dueDate: Date;
}

/**
 * Calculate billing period for a given date based on bill_date and due_date
 * @param billDate Day of month (1-31) when bill is generated
 * @param dueDate Day of month (1-31) when payment is due
 * @param referenceDate Reference date to calculate period for
 * @returns Billing period with start, end, bill date, and due date
 */
export function getBillingPeriodForDate(
  billDate: number,
  dueDate: number,
  referenceDate: Date
): BillingPeriod {
  const ref = dayjs(referenceDate);
  const billThisMonth = ref.date(billDate);

  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  if (ref.isBefore(billThisMonth) || ref.isSame(billThisMonth, 'day')) {
    // Still in current cycle that started last month
    start = billThisMonth.subtract(1, 'month').add(1, 'day');
    end = billThisMonth;
  } else {
    // Cycle starting this month
    start = billThisMonth.add(1, 'day');
    end = billThisMonth.add(1, 'month');
  }

  const due = dayjs(end).date(dueDate);

  return {
    start: start.toDate(),
    end: end.toDate(),
    billDate: end.toDate(),
    dueDate: due.toDate(),
  };
}

/**
 * Get billing period for a specific month/year
 */
export function getBillingPeriodForMonth(
  billDate: number,
  dueDate: number,
  month: number,
  year: number
): BillingPeriod {
  const referenceDate = dayjs().year(year).month(month - 1).date(15); // Mid-month reference
  return getBillingPeriodForDate(billDate, dueDate, referenceDate.toDate());
}

/**
 * Get current billing period
 */
export function getCurrentBillingPeriod(
  billDate: number,
  dueDate: number
): BillingPeriod {
  return getBillingPeriodForDate(billDate, dueDate, new Date());
}
