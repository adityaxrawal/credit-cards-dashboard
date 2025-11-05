"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  BellOff,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
  Filter,
  Settings,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/switch";

interface Alert {
  id: string;
  alert_type: string;
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  dismissed: boolean;
  action_url?: string;
  action_label?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface AlertRule {
  id: string;
  rule_name: string;
  rule_type: string;
  condition: Record<string, unknown>;
  alert_priority: string;
  alert_channels: string[];
  is_active: boolean;
  triggered_count: number;
  last_triggered_at?: string;
}

export default function NotificationsPage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ["alerts", filterType, filterPriority, showUnreadOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("types", filterType);
      if (filterPriority !== "all") params.append("priority", filterPriority);
      if (showUnreadOnly) params.append("unread_only", "true");
      params.append("limit", "50");

      const response = await apiClient.get<any>(
        `/api/alerts?${params.toString()}`
      );
      return response.data;
    },
  });

  // Fetch alert analytics
  const { data: analytics } = useQuery({
    queryKey: ["alert-analytics"],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        "/api/alerts/analytics?days=30"
      );
      return response.data?.analytics;
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiClient.put(`/api/alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-analytics"] });
    },
  });

  // Mark multiple as read
  const markMultipleAsReadMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      await apiClient.post("/api/alerts/bulk-read", { alertIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiClient.delete(`/api/alerts/${alertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  // Record interaction
  const recordInteraction = async (
    alertId: string,
    interactionType: string
  ) => {
    try {
      await apiClient.post(`/api/alerts/${alertId}/interact`, {
        interactionType,
      });
    } catch (error) {
      console.error("Error recording interaction:", error);
    }
  };

  const handleAlertClick = (alert: Alert) => {
    if (!alert.is_read) {
      markAsReadMutation.mutate(alert.id);
    }
    recordInteraction(alert.id, "viewed");
  };

  const handleActionClick = (alert: Alert) => {
    recordInteraction(alert.id, "action_taken");
    if (alert.action_url) {
      window.location.href = alert.action_url;
    }
  };

  const alerts = alertsData?.alerts || [];
  const summary = alertsData?.summary || {};

  // Filter alerts by search term
  const filteredAlerts = alerts.filter((alert: Alert) =>
    searchTerm
      ? alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const unreadCount = alerts.filter((a: Alert) => !a.is_read).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${
                  unreadCount > 1 ? "s" : ""
                }`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                markMultipleAsReadMutation.mutate(
                  alerts
                    .filter((a: Alert) => !a.is_read)
                    .map((a: Alert) => a.id)
                )
              }
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button>
            <Settings className="w-4 h-4 mr-2" />
            Notification Settings
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalAlerts}</div>
              <p className="text-xs text-gray-600">Last 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.readRate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-600">Engagement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                High Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {analytics.byPriority?.high || 0}
              </div>
              <p className="text-xs text-gray-600">Needs attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.clickThroughRate.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-600">Action taken</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="budget_threshold">Budget</SelectItem>
                    <SelectItem value="bill_reminder">Bills</SelectItem>
                    <SelectItem value="unusual_activity">Activity</SelectItem>
                    <SelectItem value="insight">Insights</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showUnreadOnly}
                    onCheckedChange={setShowUnreadOnly}
                  />
                  <Label>Unread only</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerts List */}
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BellOff className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-gray-600">
                  {searchTerm
                    ? "No notifications match your search"
                    : "You're all caught up!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((alert: Alert) => (
                <Card
                  key={alert.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    !alert.is_read
                      ? "border-l-4 border-l-blue-500 bg-blue-50/50"
                      : ""
                  }`}
                  onClick={() => handleAlertClick(alert)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {alert.priority === "high" ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          ) : alert.priority === "medium" ? (
                            <Bell className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <Info className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{alert.title}</h4>
                            <Badge
                              variant={
                                alert.priority === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {alert.priority}
                            </Badge>
                            <Badge variant="outline">{alert.alert_type}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                            {alert.is_read && (
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                Read
                              </span>
                            )}
                          </div>
                          {alert.action_label && alert.action_url && (
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(alert);
                              }}
                            >
                              {alert.action_label}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!alert.is_read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReadMutation.mutate(alert.id);
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAlertMutation.mutate(alert.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules">
          <AlertRulesManagement />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <NotificationPreferences />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Alert Rules Management Component
function AlertRulesManagement() {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: rulesData } = useQuery({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const response = await apiClient.get<any>("/api/alerts/rules");
      return response.data?.rules;
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiClient.post("/api/alerts/rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setShowAddForm(false);
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({
      ruleId,
      isActive,
    }: {
      ruleId: string;
      isActive: boolean;
    }) => {
      await apiClient.put(`/api/alerts/rules/${ruleId}`, {
        is_active: isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiClient.delete(`/api/alerts/rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const rules = rulesData || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Custom Alert Rules</h3>
          <p className="text-sm text-gray-600">
            Create automated alerts based on your spending patterns
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Alert Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const ruleType = formData.get("ruleType") as string;

                let condition = {};
                if (ruleType === "spending_threshold") {
                  condition = {
                    amount: parseFloat(formData.get("amount") as string),
                  };
                } else if (ruleType === "merchant_alert") {
                  condition = { merchant: formData.get("merchant") as string };
                } else if (ruleType === "category_limit") {
                  condition = { category: formData.get("category") as string };
                }

                createRuleMutation.mutate({
                  ruleName: formData.get("ruleName"),
                  ruleType,
                  condition,
                  alertPriority: formData.get("alertPriority"),
                  alertChannels: ["in_app", "email"],
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input
                  id="ruleName"
                  name="ruleName"
                  placeholder="e.g., Large Transaction Alert"
                  required
                />
              </div>
              <div>
                <Label htmlFor="ruleType">Rule Type</Label>
                <Select name="ruleType" defaultValue="spending_threshold">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spending_threshold">
                      Spending Threshold
                    </SelectItem>
                    <SelectItem value="merchant_alert">
                      Merchant Alert
                    </SelectItem>
                    <SelectItem value="category_limit">
                      Category Limit
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Threshold Amount (₹)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  placeholder="5000"
                />
              </div>
              <div>
                <Label htmlFor="alertPriority">Priority</Label>
                <Select name="alertPriority" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRuleMutation.isPending}>
                  Create Rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {rules.map((rule: AlertRule) => (
          <Card key={rule.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{rule.rule_name}</h4>
                    <Badge variant="outline">{rule.rule_type}</Badge>
                    <Badge
                      variant={
                        rule.alert_priority === "high"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {rule.alert_priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Triggered {rule.triggered_count} times
                  </p>
                  {rule.last_triggered_at && (
                    <p className="text-xs text-gray-500">
                      Last triggered:{" "}
                      {new Date(rule.last_triggered_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label>Active</Label>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleRuleMutation.mutate({
                          ruleId: rule.id,
                          isActive: checked,
                        })
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRuleMutation.mutate(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Notification Preferences Component
function NotificationPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const response = await apiClient.get<any>("/api/alerts/preferences");
      return response.data?.preferences;
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiClient.put("/api/alerts/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  if (!preferences) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Notifications</Label>
              <p className="text-sm text-gray-600">
                Receive alerts and notifications
              </p>
            </div>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({ enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Quiet Hours</Label>
              <p className="text-sm text-gray-600">
                Pause non-critical notifications
              </p>
            </div>
            <Switch
              checked={preferences.quiet_hours_enabled}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({
                  quiet_hours_enabled: checked,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Digest</Label>
              <p className="text-sm text-gray-600">
                Receive a daily summary email
              </p>
            </div>
            <Switch
              checked={preferences.frequency === "daily_digest"}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({
                  frequency: checked ? "daily_digest" : "immediate",
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Weekly Summary</Label>
              <p className="text-sm text-gray-600">
                Receive a weekly overview email
              </p>
            </div>
            <Switch
              checked={preferences.frequency === "weekly_digest"}
              onCheckedChange={(checked) =>
                updatePreferencesMutation.mutate({
                  frequency: checked ? "weekly_digest" : "immediate",
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Choose how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>In-App Notifications</Label>
            <Switch
              checked={preferences.channels?.includes?.("in_app")}
              onCheckedChange={(checked) => {
                const channels = checked
                  ? [...(preferences.channels || []), "in_app"]
                  : (preferences.channels || []).filter(
                      (c: string) => c !== "in_app"
                    );
                updatePreferencesMutation.mutate({ channels });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Email Notifications</Label>
            <Switch
              checked={preferences.channels?.includes?.("email")}
              onCheckedChange={(checked) => {
                const channels = checked
                  ? [...(preferences.channels || []), "email"]
                  : (preferences.channels || []).filter(
                      (c: string) => c !== "email"
                    );
                updatePreferencesMutation.mutate({ channels });
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
