"use client";

import React, { useMemo, useState } from "react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar as CalendarIcon, AlertCircle, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/shared/utils";
import { Badge, Card } from "@/shared/components/ui";
import { recurringApi } from "@/features/recurring/api";
import { billsApi } from "@/features/bills/api";

interface CalendarItem {
    id: string;
    name: string;
    amount: number;
    date: number;
    type: 'bill' | 'income' | 'recurring';
}

export default function CashflowPageClient() {
    const [viewDate, setViewDate] = useState(new Date());

    // Fetch recurring transactions from API
    const { data: recurringPatterns = [], isLoading: recurringLoading } = useQuery({
        queryKey: ['recurring-patterns'],
        queryFn: recurringApi.getRecurringTransactions,
    });

    // Fetch upcoming bills from API
    const { data: upcomingBills = [], isLoading: billsLoading } = useQuery({
        queryKey: ['bills-upcoming'],
        queryFn: billsApi.getUpcoming,
    });

    const isLoading = recurringLoading || billsLoading;

    // Transform recurring patterns and bills into calendar items
    const calendarItems: CalendarItem[] = useMemo(() => {
        const items: CalendarItem[] = [];

        // Add recurring transactions
        recurringPatterns.forEach((pattern) => {
            // Extract day of month from nextExpectedDate or use a default
            const nextDate = pattern.nextExpectedDate ? new Date(pattern.nextExpectedDate) : null;
            const dayOfMonth = nextDate ? nextDate.getDate() : 1;
            
            items.push({
                id: pattern.id,
                name: pattern.merchant || pattern.description || 'Recurring',
                amount: pattern.avgAmount || 0,
                date: dayOfMonth,
                type: pattern.direction === 'credit' ? 'income' : 'recurring',
            });
        });

        // Add upcoming bills
        upcomingBills.forEach((bill) => {
            const dueDate = bill.due_date ? new Date(bill.due_date) : null;
            const dayOfMonth = dueDate ? dueDate.getDate() : 1;
            
            items.push({
                id: bill.id,
                name: bill.card_name || 'Bill',
                amount: bill.bill_amount || 0,
                date: dayOfMonth,
                type: 'bill',
            });
        });

        return items;
    }, [recurringPatterns, upcomingBills]);

    // Generate Calendar Days
    const calendarDays = useMemo(() => {
        const start = startOfMonth(viewDate);
        const end = endOfMonth(viewDate);
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    // Upcoming List (Next 7 Days)
    const upcomingItems = useMemo(() => {
        const today = new Date();
        const nextWeek = addDays(today, 7);
        const todayDate = today.getDate();
        const nextWeekDate = nextWeek.getDate();
        
        return calendarItems.filter(item => {
            // Handle month wrap-around
            if (nextWeekDate < todayDate) {
                // Next week crosses into next month
                return item.date >= todayDate || item.date <= nextWeekDate;
            }
            return item.date >= todayDate && item.date <= nextWeekDate;
        }).sort((a, b) => a.date - b.date);
    }, [calendarItems]);

    const getItemsForDay = (day: number) => calendarItems.filter(i => i.date === day);

    // Calculate projected end balance
    const projectedBalance = useMemo(() => {
        const totalIncome = calendarItems
            .filter(i => i.type === 'income')
            .reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = calendarItems
            .filter(i => i.type !== 'income')
            .reduce((sum, i) => sum + i.amount, 0);
        return totalIncome - totalExpenses;
    }, [calendarItems]);

    const projectedSavings = useMemo(() => {
        const totalIncome = calendarItems
            .filter(i => i.type === 'income')
            .reduce((sum, i) => sum + i.amount, 0);
        const totalExpenses = calendarItems
            .filter(i => i.type !== 'income')
            .reduce((sum, i) => sum + i.amount, 0);
        return Math.max(0, totalIncome - totalExpenses);
    }, [calendarItems]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary-green" />
                <span className="ml-3 text-secondary-text">Loading cashflow data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 mb-2">
                        Forward Cashflow
                    </h1>
                    <p className="text-secondary-text">Projected income and recurring bills for {format(viewDate, 'MMMM yyyy')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CALENDAR VIEW (2/3) */}
                <div className="lg:col-span-2 bg-card-bg border border-border rounded-2xl p-6">
                    <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-xs font-semibold text-secondary-text uppercase tracking-wider">{d}</div>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">
                        {calendarDays.map((day, idx) => {
                             const items = getItemsForDay(day.getDate());
                             const hasIncome = items.some(i => i.type === 'income');
                             const hasBill = items.some(i => i.type === 'bill' || i.type === 'recurring');
                             const isToday = isSameDay(day, new Date());

                             return (
                                 <div 
                                    key={idx} 
                                    className={cn(
                                        "min-h-[100px] border border-white/5 rounded-lg p-2 flex flex-col justify-between hover:bg-hover-bg transition-colors",
                                        isToday && "bg-primary-green/5 border-primary-green/30"
                                    )}
                                 >
                                     <span className={cn("text-sm font-medium", isToday ? "text-primary-green" : "text-secondary-text")}>
                                         {day.getDate()}
                                     </span>
                                     
                                     <div className="space-y-1">
                                         {items.slice(0, 3).map(item => (
                                             <div key={item.id} className="flex justify-between items-center text-[10px]">
                                                 <span className="truncate max-w-[60px] text-primary-text">{item.name}</span>
                                                 <span className={item.type === 'income' ? 'text-success' : 'text-error'}>
                                                     {item.type === 'income' ? '+' : '-'}{Math.round(item.amount)}
                                                 </span>
                                             </div>
                                         ))}
                                         {items.length > 3 && (
                                             <span className="text-[10px] text-muted-text">+{items.length - 3} more</span>
                                         )}
                                     </div>
                                 </div>
                             );
                        })}
                    </div>
                </div>

                {/* UPCOMING & SUMMARY (1/3) */}
                <div className="space-y-6">
                    <Card className="bg-card-bg p-6 border-border">
                        <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-accent-orange" />
                            Next 7 Days
                        </h3>
                        {upcomingItems.length === 0 ? (
                            <p className="text-secondary-text text-sm">No bills or recurring transactions due soon.</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingItems.slice(0, 5).map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-primary-bg border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center bg-card-bg p-1.5 rounded border border-white/5 min-w-[40px]">
                                                <span className="block text-xs text-secondary-text">{format(viewDate, 'MMM').toUpperCase()}</span>
                                                <span className="block text-sm font-bold text-primary-text">{item.date}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-primary-text">{item.name}</p>
                                                <p className="text-xs text-secondary-text capitalize">{item.type}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={cn(
                                                "block font-mono font-bold text-sm",
                                                item.type === 'income' ? 'text-success' : 'text-primary-text'
                                            )}>
                                                {item.type === 'income' ? '+' : ''}{formatCurrency(item.amount)}
                                            </span>
                                            {item.type !== 'income' && (
                                                <Badge label="Due" variant="warning" size="sm" className="mt-1" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="w-full mt-4 py-2 text-sm text-primary-green hover:bg-primary-green/10 rounded-lg transition-colors flex items-center justify-center gap-2">
                            View All Recurring <ArrowRight className="w-4 h-4" />
                        </button>
                    </Card>

                    <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6 border-indigo-500/20">
                         <h3 className="text-sm font-semibold text-indigo-100 mb-1">Projected Monthly Balance</h3>
                         <p className={cn(
                             "text-3xl font-mono font-bold mb-4",
                             projectedBalance >= 0 ? "text-white" : "text-error"
                         )}>
                             {formatCurrency(Math.abs(projectedBalance))}
                             {projectedBalance < 0 && <span className="text-sm ml-2">deficit</span>}
                         </p>
                         <p className="text-xs text-indigo-300">
                             Based on your recurring income and expenses, you are projected to 
                             {projectedSavings > 0 ? (
                                 <> save <span className="text-emerald-400 font-bold">{formatCurrency(projectedSavings)}</span> this month.</>
                             ) : (
                                 <> have a balanced budget this month.</>
                             )}
                         </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
