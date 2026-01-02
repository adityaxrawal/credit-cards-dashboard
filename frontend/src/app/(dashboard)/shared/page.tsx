'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/primitives/card';
import { Button } from '@/shared/components/ui/primitives/Button';
import { Badge } from '@/shared/components/ui/primitives/Badge';
import apiClient from '@/lib/api-client';
import { SharedExpenseGroup } from '@/types/shared-expenses';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/date';

export default function SharedExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<SharedExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await apiClient.get<SharedExpenseGroup[]>('/shared-expenses');
      if (response.data) {
        setExpenses(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch shared expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary-green to-emerald-600 bg-clip-text text-transparent">
            Shared Expenses
          </h1>
          <p className="text-muted-text mt-1">
            Track and settle expenses with friends and family
          </p>
        </div>
        <Button onClick={() => router.push('/shared/new')} className="btn-primary shadow-lg shadow-primary-green/20">
          <Plus className="mr-2 h-4 w-4" />
          New Group Expense
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1, 2, 3].map((i) => (
             <Card key={i} className="h-48 animate-pulse bg-card-bg/50 border-input" />
           ))}
        </div>
      ) : expenses.length === 0 ? (
        <Card className="bg-card-bg/50 border-dashed border-2 border-input min-h-[300px] flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="bg-primary-bg p-4 rounded-full inline-block">
                    <Users className="h-8 w-8 text-muted-text" />
                </div>
                <h3 className="text-xl font-medium">No shared expenses yet</h3>
                <p className="text-muted-text max-w-sm mx-auto">
                    Create a group expense to start tracking split costs with others.
                </p>
                <Button onClick={() => router.push('/shared/new')} variant="outline" className="mt-4">
                    Create your first expense
                </Button>
            </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {expenses.map((group) => (
            <Card 
                key={group.id} 
                className="group hover:shadow-lg hover:shadow-primary-green/5 transition-all duration-300 border-input bg-card-bg cursor-pointer relative overflow-hidden"
                onClick={() => router.push(`/shared/${group.id}`)}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary-green to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="line-clamp-1">{group.description}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-xs">
                          <Users className="h-3 w-3" />
                          {group.group_name || 'General Group'}
                        </CardDescription>
                    </div>
                    <Badge variant={group.is_settled ? "success" : "warning"} className="ml-2">
                        {group.is_settled ? 'Settled' : 'Active'}
                    </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="text-sm text-muted-text">Total Amount</div>
                        <div className="text-2xl font-bold text-primary-text">
                            {formatCurrency(group.total_amount, group.currency || 'INR')}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-input">
                        <div className="flex items-center justify-between text-xs text-muted-text">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(group.expense_date)}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(group.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
