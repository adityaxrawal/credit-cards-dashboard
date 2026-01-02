"use client";

import React, { useMemo, useState } from "react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar as CalendarIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/shared/utils";
import { Badge, Card } from "@/shared/components/ui";

// Mock API for Cashflow/Recurring (Until we connect real endpoint)
const mockRecurring = [
    { id: '1', name: 'Netflix', amount: 15.99, date: 15, type: 'bill' },
    { id: '2', name: 'Rent', amount: 2500, date: 1, type: 'bill' },
    { id: '3', name: 'Spotify', amount: 9.99, date: 22, type: 'bill' },
    { id: '4', name: 'Salary', amount: 5000, date: 30, type: 'income' },
    { id: '5', name: 'Internet', amount: 80, date: 12, type: 'bill' },
];

export default function CashflowPageClient() {
    const [viewDate, setViewDate] = useState(new Date());

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
        // Simple mock filter logic
        return mockRecurring.filter(item => {
            // Note: In real app, check against full date logic
            return item.date >= today.getDate() && item.date <= nextWeek.getDate();
        }).sort((a, b) => a.date - b.date);
    }, []);

    const getItemsForDay = (day: number) => mockRecurring.filter(i => i.date === day);

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
                        {/* Day Padding would go here */}
                        {calendarDays.map((day, idx) => {
                             const items = getItemsForDay(day.getDate());
                             const hasIncome = items.some(i => i.type === 'income');
                             const hasBill = items.some(i => i.type === 'bill');
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
                                         {items.map(item => (
                                             <div key={item.id} className="flex justify-between items-center text-[10px]">
                                                 <span className="truncate max-w-[60px] text-primary-text">{item.name}</span>
                                                 <span className={item.type === 'income' ? 'text-success' : 'text-error'}>
                                                     {item.type === 'income' ? '+' : ''}{Math.round(item.amount)}
                                                 </span>
                                             </div>
                                         ))}
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
                            <p className="text-secondary-text text-sm">No bills due soon.</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-primary-bg border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="text-center bg-card-bg p-1.5 rounded border border-white/5 min-w-[40px]">
                                                <span className="block text-xs text-secondary-text">OCT</span>
                                                <span className="block text-sm font-bold text-primary-text">{item.date}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm text-primary-text">{item.name}</p>
                                                <p className="text-xs text-secondary-text capitalize">{item.type}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-mono font-bold text-sm text-primary-text">{formatCurrency(item.amount)}</span>
                                            <Badge label="Due" variant="warning" size="sm" className="mt-1" />
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
                         <h3 className="text-sm font-semibold text-indigo-100 mb-1">Projected End Balance</h3>
                         <p className="text-3xl font-mono font-bold text-white mb-4">$12,450.00</p>
                         <p className="text-xs text-indigo-300">
                             Based on your average spending and upcoming income, you are on track to save <span className="text-emerald-400 font-bold">$2,100</span> this month.
                         </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
