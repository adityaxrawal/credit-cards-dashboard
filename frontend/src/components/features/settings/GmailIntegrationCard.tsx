"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

// Simple card components since we're using Tailwind
const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`bg-white rounded-lg shadow ${className}`}>{children}</div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 border-b border-gray-200">{children}</div>
);

const CardTitle = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;

const CardDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-600 mt-1">{children}</p>
);

const CardContent = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`p-6 ${className}`}>{children}</div>;

const Alert = ({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}) => (
  <div
    className={`p-4 rounded-lg border ${
      variant === "destructive"
        ? "bg-red-50 border-red-200"
        : "bg-blue-50 border-blue-200"
    }`}
  >
    {children}
  </div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm flex items-center gap-2">{children}</p>
);

interface GmailStatus {
  connected: boolean;
  email?: string;
  watchExpiration?: string;
  historyId?: string;
  lastSync?: string;
}

export default function GmailIntegrationCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGmailStatus();
  }, []);

  async function fetchGmailStatus() {
    try {
      setLoading(true);
      const data = await apiClient.get<GmailStatus>("/api/gmail/status");
      setStatus(data.data ?? null);
    } catch (err) {
      console.error("Failed to fetch Gmail status:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setConnecting(true);
      setError(null);

      // Get authorization URL from backend
      const data = await apiClient.get<{ authUrl: string }>(
        "/api/gmail/auth-url"
      );
      const authUrl = data.data?.authUrl;

      if (!authUrl) {
        throw new Error("No authorization URL received");
      }

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Gmail");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Are you sure you want to disconnect Gmail? Transaction extraction will stop."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiClient.post("/api/gmail/disconnect", {});

      setStatus(null);
      await fetchGmailStatus();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disconnect Gmail"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReauthorize() {
    // Same as connect
    await handleConnect();
  }

  const isWatchExpiring = status?.watchExpiration
    ? new Date(status.watchExpiration).getTime() - Date.now() <
      24 * 60 * 60 * 1000
    : false;

  const isWatchExpired = status?.watchExpiration
    ? new Date(status.watchExpiration).getTime() < Date.now()
    : false;

  if (loading && !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Gmail Integration
        </CardTitle>
        <CardDescription>
          Connect your Gmail account to automatically extract transactions from
          bank emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!status?.connected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
              <h4 className="font-medium text-sm mb-2">How it works:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>
                    We&apos;ll securely connect to your Gmail with read-only
                    access
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>
                    Bank transaction emails will be automatically detected and
                    extracted
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>
                    Transactions appear in your dashboard within minutes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>You can disconnect anytime</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full"
              size="lg"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Connected</p>
                  <p className="text-sm text-gray-600">{status.email}</p>
                </div>
              </div>
              <Badge
                label="Active"
                variant="success"
                className="bg-green-100 text-green-800 border-green-200"
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Last Sync</span>
                <span className="font-medium">
                  {status.lastSync
                    ? new Date(status.lastSync).toLocaleString()
                    : "Never"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Watch Status</span>
                <div className="flex items-center gap-2">
                  {isWatchExpired ? (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 font-medium">Expired</span>
                    </>
                  ) : isWatchExpiring ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-600 font-medium">
                        Expiring Soon
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-600 font-medium">Active</span>
                    </>
                  )}
                </div>
              </div>
              {status.watchExpiration && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">Watch Expires</span>
                  <span className="font-medium">
                    {new Date(status.watchExpiration).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {(isWatchExpiring || isWatchExpired) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Gmail watch is{" "}
                  {isWatchExpired ? "expired" : "expiring soon"}. Click
                  Reauthorize to renew real-time sync.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleReauthorize}
                variant="secondary"
                className="flex-1"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reauthorize
              </Button>
              <Button
                onClick={handleDisconnect}
                variant="error"
                className="flex-1"
                disabled={loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
