"use client";

import { useState, useEffect } from "react";
import { Check, X, Edit2, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface ReviewItem {
  id: string;
  email_message_id: string;
  from_email: string;
  subject: string;
  confidence: number;
  extracted_data: {
    amount: number;
    merchant: string;
    cardLast4?: string;
    transactionType: string;
    date?: string;
  };
  extraction_method: string;
  created_at: string;
}

export default function ManualReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<
    ReviewItem["extracted_data"] | null
  >(null);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      const data = await apiClient.get("/api/review/pending");
      setItems((data as unknown as { items: ReviewItem[] }).items || []);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (
    id: string,
    editedTransaction?: ReviewItem["extracted_data"]
  ) => {
    try {
      await apiClient.put(`/api/review/${id}/approve`, { editedTransaction });
      setItems(items.filter((item) => item.id !== id));
      setEditingId(null);
      setEditedData(null);
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      await apiClient.put(`/api/review/${id}/reject`, { reason });
      setItems(items.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to reject:", error);
    }
  };

  const startEdit = (item: ReviewItem) => {
    setEditingId(item.id);
    setEditedData({ ...item.extracted_data });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedData(null);
  };

  const saveEdit = (id: string) => {
    if (editedData) {
      handleApprove(id, editedData);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading reviews...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          All Caught Up!
        </h3>
        <p className="text-gray-600">No transactions require manual review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Manual Review Queue
        </h2>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
          {items.length} pending
        </span>
      </div>

      {items.map((item) => {
        const isEditing = editingId === item.id;
        const data =
          (isEditing ? editedData : item.extracted_data) || item.extracted_data;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-gray-200 bg-white p-6 space-y-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">
                    Low Confidence: {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{item.subject}</h3>
                <p className="text-sm text-gray-600">From: {item.from_email}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Method: {item.extraction_method}
                </p>
              </div>
            </div>

            {/* Extracted Data */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Extracted Transaction Data
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Amount
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={data.amount}
                      onChange={(e) =>
                        setEditedData({
                          ...data,
                          amount: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-lg font-bold text-gray-900">
                      ₹{data.amount?.toLocaleString()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Merchant
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={data.merchant}
                      onChange={(e) =>
                        setEditedData({ ...data, merchant: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">
                      {data.merchant}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Card Last 4
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={data.cardLast4 || ""}
                      onChange={(e) =>
                        setEditedData({ ...data, cardLast4: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      maxLength={4}
                    />
                  ) : (
                    <div className="text-gray-900">
                      ****{data.cardLast4 || "----"}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Type
                  </label>
                  {isEditing ? (
                    <select
                      value={data.transactionType}
                      onChange={(e) =>
                        setEditedData({
                          ...data,
                          transactionType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="debit">Debit</option>
                      <option value="credit">Credit</option>
                      <option value="payment">Payment</option>
                      <option value="refund">Refund</option>
                    </select>
                  ) : (
                    <div className="text-gray-900 capitalize">
                      {data.transactionType}
                    </div>
                  )}
                </div>
              </div>

              {data.date && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Date
                  </label>
                  <div className="text-gray-900">{data.date}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => saveEdit(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Save & Approve
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      handleReject(item.id, "Incorrect extraction")
                    }
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
