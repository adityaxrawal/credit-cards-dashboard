'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button, Modal, Input, Label } from '@/components/ui';
import { toast } from '@/components/ui/feedback/Toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'csv' | 'excel';

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const endpoint = format === 'csv' 
        ? '/reports/transactions/export/csv' 
        : '/reports/transactions/export/excel';

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api${endpoint}?${params.toString()}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `transactions.${format === 'csv' ? 'csv' : 'xlsx'}`;

      const rowCount = response.headers.get('X-Row-Count');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${rowCount || 'all'} transactions successfully`);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export transactions');
    } finally {
      setIsExporting(false);
    }
  };

  const setPresetRange = (preset: 'week' | 'month' | '3months' | 'year' | 'all') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    
    switch (preset) {
      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        setFromDate(formatDate(weekAgo));
        setToDate(formatDate(today));
        break;
      case 'month':
        const monthAgo = new Date();
        monthAgo.setMonth(today.getMonth() - 1);
        setFromDate(formatDate(monthAgo));
        setToDate(formatDate(today));
        break;
      case '3months':
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        setFromDate(formatDate(threeMonthsAgo));
        setToDate(formatDate(today));
        break;
      case 'year':
        const yearAgo = new Date();
        yearAgo.setFullYear(today.getFullYear() - 1);
        setFromDate(formatDate(yearAgo));
        setToDate(formatDate(today));
        break;
      case 'all':
        setFromDate('');
        setToDate('');
        break;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Transactions">
      <div className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label>Export Format</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                className="w-4 h-4"
              />
              <span>CSV (.csv)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="excel"
                checked={format === 'excel'}
                onChange={() => setFormat('excel')}
                className="w-4 h-4"
              />
              <span>Excel (.xlsx)</span>
            </label>
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label>Date Range</Label>
          
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {(['week', 'month', '3months', 'year', 'all'] as const).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => setPresetRange(preset)}
              >
                {preset === 'week' && 'Last Week'}
                {preset === 'month' && 'Last Month'}
                {preset === '3months' && 'Last 3 Months'}
                {preset === 'year' && 'Last Year'}
                {preset === 'all' && 'All Time'}
              </Button>
            ))}
          </div>

          {/* Custom date inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
