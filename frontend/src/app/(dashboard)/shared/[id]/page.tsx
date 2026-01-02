'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Trash, User, Calendar, DollarSign, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/primitives/card';
import { Button } from '@/shared/components/ui/primitives/Button';
import { Badge } from '@/shared/components/ui/primitives/Badge';
import apiClient from '@/lib/api-client';
import { SharedExpenseGroup, ExpenseSplit } from '@/types/shared-expenses';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDate } from '@/shared/utils/date';
import { toastService } from '@/shared/utils/toast';

export default function SharedExpenseDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [expense, setExpense] = useState<SharedExpenseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    fetchExpenseDetails();
  }, [params.id]);

  const fetchExpenseDetails = async () => {
    try {
      const response = await apiClient.get<SharedExpenseGroup>(`/shared-expenses/${params.id}`);
      if (response.data) {
        setExpense(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch expense details:', error);
      toastService.error('Failed to load expense details');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleSplit = async (split: ExpenseSplit) => {
    if (split.is_paid_by || split.is_settled) return;
    
    setSettlingId(split.id);
    try {
      await apiClient.post(`/shared-expenses/splits/${split.id}/pay`);
      toastService.success(`Marked ${split.participant_name}'s share as paid`);
      fetchExpenseDetails(); // Refresh to update status
    } catch (error) {
      console.error('Failed to settle split:', error);
      toastService.error('Failed to settle split');
    } finally {
      setSettlingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this shared expense? This cannot be undone.')) return;
    
    try {
      await apiClient.delete(`/shared-expenses/${params.id}`);
      toastService.success('Shared expense deleted');
      router.push('/shared');
    } catch (error) {
       console.error('Failed to delete expense:', error);
       toastService.error('Failed to delete expense');
    }
  };

  if (loading) {
    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            <div className="h-8 w-32 bg-card-bg/50 animate-pulse rounded" />
            <div className="h-64 bg-card-bg/50 animate-pulse rounded-xl" />
        </div>
    );
  }

  if (!expense) {
    return (
        <div className="container mx-auto p-6 max-w-4xl text-center">
            <h2 className="text-xl font-bold">Expense not found</h2>
            <Button onClick={() => router.push('/shared')} className="mt-4">Back to List</Button>
        </div>
    );
  }

  // Calculate stats
  const totalSettled = expense.splits.reduce((acc, split) => acc + (split.is_settled || split.is_paid_by ? Number(split.share_amount) : 0), 0);
  const progress = (totalSettled / expense.total_amount) * 100;

  return (
    <div className="space-y-6 container mx-auto p-6 max-w-4xl animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <Button 
            variant="ghost" 
            onClick={() => router.push('/shared')}
            className="pl-0 hover:bg-transparent hover:text-primary-green"
        >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shared Expenses
        </Button>
        <Button onClick={handleDelete} variant="destructive" size="sm" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
            <Trash className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Card */}
        <div className="md:col-span-2 space-y-6">
            <Card className="card-shadow border-t-4 border-t-primary-green bg-card-bg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">{expense.description}</CardTitle>
                            <CardDescription className="text-base mt-1 flex items-center gap-2">
                                <Share2 className="h-4 w-4" />
                                {expense.group_name}
                            </CardDescription>
                        </div>
                        <Badge variant={expense.is_settled ? "success" : "warning"} size="lg">
                            {expense.is_settled ? 'Fully Settled' : ' Settlement Pending'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-6 text-sm text-muted-text">
                        <span className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {formatDate(expense.expense_date)}
                        </span>
                        <span className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency(expense.total_amount, expense.currency)}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Settlement Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-primary-bg rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary-green transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <h3 className="text-xl font-bold text-primary-text">Splits & Settlements</h3>
            <div className="grid gap-4">
                {expense.splits.map((split) => (
                    <Card key={split.id} className="bg-card-bg border-input hover:border-primary-green/50 transition-colors">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${split.is_paid_by ? 'bg-primary-green/20 text-primary-green' : 'bg-primary-bg text-muted-text'}`}>
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-primary-text">{split.participant_name}</p>
                                    <p className="text-xs text-muted-text">
                                        {split.is_paid_by ? 'Paid full amount' : `Owes ${formatCurrency(split.share_amount, expense.currency)}`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="font-bold text-primary-text">{formatCurrency(split.share_amount, expense.currency)}</p>
                                    <p className="text-xs text-muted-text">{split.share_percent}%</p>
                                </div>
                                
                                {split.is_paid_by ? (
                                    <Badge variant="success">Payer</Badge>
                                ) : split.is_settled ? (
                                    <Badge variant="success" icon={<CheckCircle className="h-3 w-3 mr-1"/>}>
                                        Settled
                                    </Badge>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleSettleSplit(split)}
                                        disabled={!!settlingId}
                                        className="text-primary-green border-primary-green/20 hover:bg-primary-green/10"
                                    >
                                        {settlingId === split.id ? '...' : 'Mark Paid'}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>

        {/* Sidebar / Summary */}
        <div className="space-y-6">
            <Card className="bg-primary-bg/50 border-input">
                <CardHeader>
                    <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-text">Total Cost</span>
                        <span className="font-bold">{formatCurrency(expense.total_amount, expense.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-text">Your Share</span>
                        <span className="font-bold">
                            {formatCurrency(
                                expense.splits.find(s => s.participant_name === 'You')?.share_amount || 0,
                                expense.currency
                            )}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
