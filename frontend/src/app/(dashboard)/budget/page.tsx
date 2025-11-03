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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings,
  Plus,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CategoryBudget {
  category: string;
  spent: number;
  budget: number;
  percentage: number;
  status: string;
}

interface CardBudget {
  cardId: string;
  cardName: string;
  budgetLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: string;
}

interface Forecast {
  forecast_date: string;
  predicted_amount: number;
  confidence_level: number;
}

export default function BudgetDashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  // Fetch comprehensive budget analytics
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["budget-analytics"],
    queryFn: async () => {
      const response = await apiClient.get("/api/budget/analytics");
      return response.data.data;
    },
  });

  // Fetch current budget
  const { data: currentBudget } = useQuery({
    queryKey: ["current-budget"],
    queryFn: async () => {
      const response = await apiClient.get("/api/budget/current");
      return response.data.data;
    },
  });

  // Fetch category budgets
  const { data: categoryData } = useQuery({
    queryKey: ["category-budgets"],
    queryFn: async () => {
      const response = await apiClient.get("/api/budget/categories");
      return response.data.data;
    },
  });

  // Fetch card budgets
  const { data: cardBudgets } = useQuery({
    queryKey: ["card-budgets", selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await apiClient.get(
        `/api/budget/cards?month=${selectedMonth}&year=${selectedYear}`
      );
      return response.data.data.cardBudgets;
    },
  });

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async ({
      budgetLimit,
      effectiveFrom,
    }: {
      budgetLimit: number;
      effectiveFrom: string;
    }) => {
      const response = await apiClient.put("/api/budget", {
        budgetLimit,
        effectiveFrom,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["current-budget"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const trends = analytics?.trends || {};
  const forecasts = analytics?.forecasts || [];
  const recommendations = analytics?.recommendations || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-gray-600 mt-1">
            Track and manage your spending budgets
          </p>
        </div>
        <Button>
          <Settings className="w-4 h-4 mr-2" />
          Budget Settings
        </Button>
      </div>

      {/* Budget Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Budget
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{overview.budgetLimit?.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">Budget limit set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{overview.totalSpent?.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {overview.percentage?.toFixed(1)}% of budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{overview.remaining?.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">Available to spend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {overview.status === "safe" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {overview.status}
            </div>
            <Progress
              value={overview.percentage}
              className="mt-2"
              indicatorClassName={
                overview.status === "exceeded"
                  ? "bg-red-600"
                  : overview.status === "critical"
                  ? "bg-orange-600"
                  : overview.status === "warning"
                  ? "bg-yellow-600"
                  : "bg-green-600"
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget Recommendations</CardTitle>
            <CardDescription>
              Smart insights to help you manage your budget better
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    rec.priority === "high"
                      ? "bg-red-50 border-red-500"
                      : rec.priority === "medium"
                      ? "bg-yellow-50 border-yellow-500"
                      : "bg-blue-50 border-blue-500"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {rec.message}
                      </p>
                      {rec.action && (
                        <p className="text-sm text-gray-700 mt-2 font-medium">
                          → {rec.action}
                        </p>
                      )}
                    </div>
                    {rec.potentialSavings && (
                      <div className="ml-4 text-right">
                        <p className="text-xs text-gray-600">
                          Potential Savings
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          ₹{rec.potentialSavings.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Spending Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends.historicalSpending || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(value) =>
                        new Date(2024, value - 1).toLocaleString("default", {
                          month: "short",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) =>
                        `₹${value.toLocaleString()}`
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="spent"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Spent"
                    />
                    <Line
                      type="monotone"
                      dataKey="budget"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Budget"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Current Month Weekly Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Breakdown</CardTitle>
                <CardDescription>
                  Current month spending pattern
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={currentBudget?.breakdown?.byWeek || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="week"
                      label={{ value: "Week", position: "insideBottom" }}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) =>
                        `₹${value.toLocaleString()}`
                      }
                    />
                    <Bar dataKey="spent" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <CategoryBudgetManagement
            categories={categoryData?.categories || []}
            spending={categoryData?.spending || []}
          />
        </TabsContent>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <CardBudgetManagement
            cardBudgets={cardBudgets || []}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
          />
        </TabsContent>

        {/* Forecasts Tab */}
        <TabsContent value="forecasts" className="space-y-4">
          <ForecastView forecasts={forecasts} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <BudgetHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Category Budget Management Component
function CategoryBudgetManagement({
  categories,
  spending,
}: {
  categories: any[];
  spending: CategoryBudget[];
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/api/budget/categories", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-budgets"] });
      setShowAddForm(false);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Category Budgets</h3>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category Budget
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Category Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createCategoryMutation.mutate({
                  categoryName: formData.get("categoryName"),
                  budgetLimit: parseFloat(
                    formData.get("budgetLimit") as string
                  ),
                  periodType: formData.get("periodType"),
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="categoryName">Category Name</Label>
                <Input
                  id="categoryName"
                  name="categoryName"
                  placeholder="e.g., Dining, Shopping"
                  required
                />
              </div>
              <div>
                <Label htmlFor="budgetLimit">Budget Limit (₹)</Label>
                <Input
                  id="budgetLimit"
                  name="budgetLimit"
                  type="number"
                  placeholder="10000"
                  required
                />
              </div>
              <div>
                <Label htmlFor="periodType">Period Type</Label>
                <Select name="periodType" defaultValue="monthly">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                >
                  Create Budget
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {spending.map((cat) => (
          <Card key={cat.category}>
            <CardHeader>
              <CardTitle className="text-lg">{cat.category}</CardTitle>
              <CardDescription>
                ₹{cat.spent.toLocaleString()} / ₹{cat.budget.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={cat.percentage} className="mb-2" />
              <div className="flex justify-between text-sm">
                <span>{cat.percentage.toFixed(1)}% used</span>
                <span
                  className={
                    cat.status === "exceeded"
                      ? "text-red-600 font-semibold"
                      : cat.status === "critical"
                      ? "text-orange-600 font-semibold"
                      : "text-green-600"
                  }
                >
                  {cat.status}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Card Budget Management Component
function CardBudgetManagement({
  cardBudgets,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: {
  cardBudgets: CardBudget[];
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Card Budgets</h3>
        <div className="flex gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => onMonthChange(parseInt(v))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <SelectItem key={month} value={month.toString()}>
                  {new Date(2024, month - 1).toLocaleString("default", {
                    month: "long",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => onYearChange(parseInt(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: 3 },
                (_, i) => new Date().getFullYear() - 1 + i
              ).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cardBudgets.map((card) => (
          <Card key={card.cardId}>
            <CardHeader>
              <CardTitle>{card.cardName}</CardTitle>
              <CardDescription>
                ₹{card.spent.toLocaleString()} / ₹
                {card.budgetLimit.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={card.percentage} className="mb-2" />
              <div className="flex justify-between text-sm">
                <span>₹{card.remaining.toLocaleString()} remaining</span>
                <span
                  className={
                    card.status === "exceeded"
                      ? "text-red-600 font-semibold"
                      : card.status === "critical"
                      ? "text-orange-600 font-semibold"
                      : "text-green-600"
                  }
                >
                  {card.percentage.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Forecast View Component
function ForecastView({ forecasts }: { forecasts: Forecast[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Forecasts</CardTitle>
        <CardDescription>
          AI-powered predictions for the next 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={forecasts}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="forecast_date"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [
                `₹${value.toFixed(2)}`,
                "Predicted",
              ]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="predicted_amount"
              stroke="#8884d8"
              strokeWidth={2}
              name="Predicted Daily Spending"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 text-sm text-gray-600">
          <p>
            These forecasts are based on your historical spending patterns and
            use machine learning to predict future expenses.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Budget History Component
function BudgetHistory() {
  const { data: history } = useQuery({
    queryKey: ["budget-history"],
    queryFn: async () => {
      const response = await apiClient.get("/api/budget/history?months=12");
      return response.data.data.history;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget History</CardTitle>
        <CardDescription>Your spending history over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(history || []).map((item: any) => (
            <div
              key={`${item.year}-${item.month}`}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <p className="font-semibold">
                  {new Date(item.year, item.month - 1).toLocaleString(
                    "default",
                    {
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {((item.total_spent / item.budget_limit) * 100).toFixed(1)}%
                  of budget used
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ₹{item.total_spent.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  of ₹{item.budget_limit.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
