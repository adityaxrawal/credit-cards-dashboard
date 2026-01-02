import React from "react";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
       <div className="bg-card-bg border border-white/5 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Recent Alerts</h3>
        <p className="text-muted-text">No critical alerts requiring attention.</p>
      </div>
    </div>
  );
}
