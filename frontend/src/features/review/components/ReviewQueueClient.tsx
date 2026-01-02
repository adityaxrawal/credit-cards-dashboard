'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Check, X, SkipForward, Loader2, RefreshCcw, AlertCircle } from 'lucide-react';
import { Button, Badge, Card } from '@/shared/components/ui';
import { useToast } from '@/shared/components/ui/feedback/Toast';
import { ReviewCard } from './ReviewCard';

interface ReviewItem {
  id: string;
  emailId: string;
  emailSubject: string;
  emailSnippet: string;
  emailSender: string;
  suggestedType: string | null;
  suggestedMerchant: string | null;
  suggestedAmount: number | null;
  reviewReason: string;
  createdAt: string;
}

interface ReviewStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export function ReviewQueueClient() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manual-review/queue`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch queue');
      
      const data = await response.json();
      setItems(data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load review queue');
      console.error(err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manual-review/stats`,
        { credentials: 'include' }
      );
      
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchQueue(), fetchStats()]);
    setIsRefreshing(false);
  }, [fetchQueue, fetchStats]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchQueue(), fetchStats()]);
      setIsLoading(false);
    };
    init();
  }, [fetchQueue, fetchStats]);

  const handleApprove = async (id: string, data: any) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manual-review/${id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) throw new Error('Failed to approve');

      toast.success('Transaction approved');
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchStats();
    } catch (err) {
      toast.error('Failed to approve item');
      console.error(err);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manual-review/${id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) throw new Error('Failed to reject');

      toast.success('Item rejected');
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchStats();
    } catch (err) {
      toast.error('Failed to reject item');
      console.error(err);
    }
  };

  const handleSkip = async (id: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manual-review/${id}/skip`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (!response.ok) throw new Error('Failed to skip');

      toast.success('Item skipped');
      setItems((prev) => prev.filter((item) => item.id !== id));
      fetchStats();
    } catch (err) {
      toast.error('Failed to skip item');
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Review Queue</h1>
          {stats && (
            <Badge variant="secondary">
              {stats.pending} pending
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={isRefreshing}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-gray-500">Pending</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.approved}</div>
            <div className="text-sm text-gray-500">Approved</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.rejected}</div>
            <div className="text-sm text-gray-500">Rejected</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!error && items.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">All Caught Up!</h3>
          <p className="text-gray-500">No items pending review.</p>
        </div>
      )}

      {/* Queue Items */}
      <div className="space-y-4">
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
            onSkip={handleSkip}
          />
        ))}
      </div>
    </div>
  );
}
