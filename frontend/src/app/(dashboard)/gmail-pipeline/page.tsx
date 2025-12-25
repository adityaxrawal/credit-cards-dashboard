'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../../components/layout/AppLayout';
import { gmailApi, ScanStatus } from '../../../lib/api/gmail';
import { Badge } from '../../../components/ui/primitives/Badge';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import GmailIntegrationCard from '../../../components/features/settings/GmailIntegrationCard';

export default function GmailPipelinePage() {
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    toDate: new Date()
  });

  // Fetch pipeline data
  const { data: pipelineStats, isLoading: statsLoading } = useQuery({
    queryKey: ['gmail-pipeline-stats'],
    queryFn: () => gmailApi.getPipelineStats()
  });

  const { data: terminatorReport } = useQuery({
    queryKey: ['gmail-terminator-report', dateRange],
    queryFn: () => gmailApi.getTerminatorReport(dateRange.fromDate, dateRange.toDate)
  });

  const { data: latestJob } = useQuery({
    queryKey: ['gmail-latest-job'],
    queryFn: () => gmailApi.getLatestJob()
  });

  const handleRunScan = async () => {
    try {
      await gmailApi.scanHistorical(dateRange.fromDate, dateRange.toDate);
      // Show success toast (TODO: Add toast)
    } catch (error) {
      console.error(error);
      // Show error toast
    }
  };

  return (
    <AppLayout title="Gmail Pipeline" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Connection Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Card - Reuse existing component */}
          <GmailIntegrationCard />

          {/* Last Sync Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <p className="text-sm text-gray-500 font-medium">Last Sync</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {latestJob?.completedAt 
                ? new Date(latestJob.completedAt).toLocaleDateString()
                : 'Never'
              }
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {latestJob?.processed || 0} emails processed
            </p>
          </div>

          {/* Watch Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <p className="text-sm text-gray-500 font-medium">Watch Status</p>
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <Badge variant="success">Active</Badge>
            </div>
          </div>
        </div>

        {/* Historical Scan Control Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Run Historical Scan</h2>
          
          <div className="space-y-4">
            {/* Date Range Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 font-medium">From Date</label>
                <input 
                  type="date" 
                  value={dateRange.fromDate.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({
                    ...dateRange,
                    fromDate: new Date(e.target.value)
                  })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 font-medium">To Date</label>
                <input 
                  type="date" 
                  value={dateRange.toDate.toISOString().split('T')[0]}
                  onChange={(e) => setDateRange({
                    ...dateRange,
                    toDate: new Date(e.target.value)
                  })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunScan}
              disabled={statsLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <RefreshCw className="inline w-4 h-4 mr-2" />
              Run Historical Scan
            </button>

            {/* Active Job Progress */}
            {latestJob?.status === 'PROCESSING' && (
              <HistoricalScanProgress job={latestJob} />
            )}
          </div>
        </div>

        {/* Pipeline Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pipeline Stats */}
          <PipelineStatsCard stats={pipelineStats} />

          {/* Terminator Report */}
          <TerminatorReportCard report={terminatorReport} />

          {/* Recent Logs */}
          <RecentLogsCard />
        </div>
      </div>
    </AppLayout>
  );
}

// Sub-components
function HistoricalScanProgress({ job }: { job: ScanStatus }) {
  const progress = job.total ? (job.processed / job.total) * 100 : 0;
  return (
    <div className="space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Progress</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {job.processed} of {job.total} emails processed
      </p>
    </div>
  );
}

function PipelineStatsCard({ stats }: { stats: any }) {
  const items = [
    { label: 'Processed', value: stats?.processed || 0, color: 'text-blue-500' },
    { label: 'Saved', value: stats?.saved || 0, color: 'text-green-500' },
    { label: 'Needs Review', value: stats?.needsReview || 0, color: 'text-yellow-500' },
    { label: 'Terminated', value: stats?.terminated || 0, color: 'text-red-500' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipeline Statistics</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{item.label}</span>
            <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminatorReportCard({ report }: { report: any }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Termination Reasons</h3>
      <div className="space-y-2">
        {report?.reasons?.slice(0, 5).map((reason: any, idx: number) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="text-gray-500 truncate" title={reason.reason}>{reason.reason}</span>
            <Badge variant="secondary">{reason.count}</Badge>
          </div>
        ))}
        {(!report?.reasons || report.reasons.length === 0) && (
            <p className="text-sm text-gray-500">No data available</p>
        )}
      </div>
    </div>
  );
}

function RecentLogsCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h3>
      <p className="text-sm text-gray-500">Extraction logs will appear here</p>
    </div>
  );
}
