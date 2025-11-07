"use client";

/**
 * Gmail Sync Button Component
 */
export default function GmailSyncButton({
  onSync,
  syncing,
}: {
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <button
      onClick={onSync}
      disabled={syncing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        syncing
          ? "bg-gray-600 cursor-not-allowed"
          : "bg-primary-green hover:bg-primary-green/90 text-white"
      }`}
    >
      {syncing ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Syncing...</span>
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Sync Gmail</span>
        </>
      )}
    </button>
  );
}
