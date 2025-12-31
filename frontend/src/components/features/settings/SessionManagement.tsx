"use client";

import React, { useState, useEffect } from "react";
import { Monitor, Smartphone, Tablet, Globe, MapPin, Clock, Trash2, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  deviceInfo: {
    browser?: string;
    os?: string;
    device?: string;
  };
  ipAddress: string;
  lastAccessedAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

interface SessionManagementProps {
  sessions: Session[];
  onRevokeSession: (sessionId: string) => Promise<void>;
  onRevokeAllSessions: () => Promise<void>;
  isLoading?: boolean;
}

const getDeviceIcon = (device?: string) => {
  if (!device) return Monitor;
  const lower = device.toLowerCase();
  if (lower.includes("mobile") || lower.includes("phone")) return Smartphone;
  if (lower.includes("tablet") || lower.includes("ipad")) return Tablet;
  return Monitor;
};

export function SessionManagement({
  sessions,
  onRevokeSession,
  onRevokeAllSessions,
  isLoading = false,
}: SessionManagementProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await onRevokeSession(sessionId);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setIsRevokingAll(true);
    try {
      await onRevokeAllSessions();
    } finally {
      setIsRevokingAll(false);
    }
  };

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-text flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Active Sessions
          </h2>
          <p className="text-sm text-secondary-text mt-1">
            Manage your active login sessions across devices
          </p>
        </div>
        {otherSessions.length > 0 && (
          <button
            onClick={handleRevokeAll}
            disabled={isRevokingAll}
            className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {isRevokingAll ? "Logging out..." : "Log out all other devices"}
          </button>
        )}
      </div>

      {/* Current Session */}
      {currentSession && (
        <div className="bg-card-bg rounded-xl p-6 border-2 border-primary/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              {React.createElement(getDeviceIcon(currentSession.deviceInfo.device), {
                className: "w-6 h-6 text-primary",
              })}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-primary-text">
                  {currentSession.deviceInfo.browser || "Unknown Browser"}
                </p>
                <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                  Current Session
                </span>
              </div>
              <p className="text-sm text-secondary-text">
                {currentSession.deviceInfo.os || "Unknown OS"}
              </p>
            </div>
            <div className="text-right text-sm text-secondary-text">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {currentSession.ipAddress}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                Active now
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-secondary-text">Other Sessions</h3>
          {otherSessions.map((session) => {
            const DeviceIcon = getDeviceIcon(session.deviceInfo.device);
            const isRevoking = revokingId === session.id;

            return (
              <div
                key={session.id}
                className="bg-card-bg rounded-xl p-4 border border-muted-text/10 flex items-center gap-4"
              >
                <div className="p-2 bg-hover-bg rounded-lg">
                  <DeviceIcon className="w-5 h-5 text-secondary-text" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary-text">
                    {session.deviceInfo.browser || "Unknown Browser"}
                  </p>
                  <p className="text-sm text-secondary-text">
                    {session.deviceInfo.os || "Unknown OS"}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-text">
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {session.ipAddress}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(session.lastAccessedAt))}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(session.id)}
                  disabled={isRevoking}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isRevoking
                      ? "bg-muted-text/10 text-muted-text cursor-not-allowed"
                      : "hover:bg-error/10 text-secondary-text hover:text-error"
                  )}
                  title="Revoke session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card-bg rounded-xl p-8 border border-muted-text/10 text-center">
          <Shield className="w-12 h-12 text-muted-text mx-auto mb-3" />
          <p className="text-secondary-text">No other active sessions</p>
          <p className="text-sm text-muted-text mt-1">
            You're only logged in on this device
          </p>
        </div>
      )}
    </div>
  );
}
