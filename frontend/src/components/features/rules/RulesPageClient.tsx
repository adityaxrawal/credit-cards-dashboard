
"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import {
  Button,
  Input,
  Badge,
  Modal,
  Card,
} from "@/components/ui";
import { rulesApi, ClassificationRule } from "@/lib/api/rules";
import { useToast } from "@/components/ui/feedback/Toast";

export default function RulesPageClient() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);

  // Fetch Rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: rulesApi.getRules,
  });

  // Mutations
  const createRule = useMutation({
    mutationFn: rulesApi.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      success("Rule created successfully");
      setIsModalOpen(false);
      setEditingRule(null);
    },
    onError: () => errorToast("Failed to create rule"),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClassificationRule> }) =>
      rulesApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      success("Rule updated successfully");
      setIsModalOpen(false);
      setEditingRule(null);
    },
    onError: () => errorToast("Failed to update rule"),
  });

  const deleteRule = useMutation({
    mutationFn: rulesApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      success("Rule deleted successfully");
    },
    onError: () => errorToast("Failed to delete rule"),
  });

  // Form State
  const [formData, setFormData] = useState<Partial<ClassificationRule>>({
    name: "",
    priority: 0,
    criteria: { field: "merchant", operator: "contains", value: "" },
    action: { category: "" },
  });

  const handleOpenModal = (rule?: ClassificationRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        priority: rule.priority,
        criteria: { ...rule.criteria },
        action: { ...rule.action },
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: "",
        priority: 0,
        criteria: { field: "merchant", operator: "contains", value: "" },
        action: { category: "" },
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, data: formData });
    } else {
      createRule.mutate(formData);
    }
  };

  return (
    <AppLayout title="Rules Engine">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Classification Rules
            </h1>
            <p className="text-gray-500 mt-1">
              Automate transaction categorization with custom rules.
            </p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Button>
        </div>

        {/* Rules List */}
        <div className="grid gap-4">
          {rules.length === 0 && !isLoading ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Zap className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No rules configured</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new classification rule.</p>
              <div className="mt-6">
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="mr-2 h-4 w-4" /> New Rule
                </Button>
              </div>
            </div>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    <Badge variant={rule.isActive ? "success" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">Priority: {rule.priority}</Badge>
                  </div>
                  <div className="text-sm text-gray-600 flex gap-4">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        IF {rule.criteria.field} {rule.criteria.operator} "{rule.criteria.value}"
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">THEN</span>
                      {rule.action.category && (
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          Set Category: {rule.action.category}
                        </span>
                      )}
                      {rule.action.merchantRename && (
                        <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                          Rename: {rule.action.merchantRename}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(rule)}>
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteRule.mutate(rule.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Modal */}
        {isModalOpen && (
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingRule ? "Edit Rule" : "Create New Rule"}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rule Name</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Uber Rides"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <Input
                      type="number"
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    />
                     <p className="text-xs text-gray-500 mt-1">Higher runs first</p>
                 </div>
                 <div className="flex items-center mt-6">
                    <input 
                        type="checkbox" 
                        id="isActive"
                        checked={formData.isActive ?? true}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">Active Rule</label>
                 </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 text-gray-900">Criteria (IF)</h4>
                <div className="grid grid-cols-3 gap-2">
                    <select 
                        className="border rounded p-2 text-sm"
                        value={formData.criteria?.field}
                        onChange={(e) => setFormData({ 
                            ...formData, 
                            criteria: { ...formData.criteria!, field: e.target.value as any } 
                        })}
                    >
                        <option value="merchant">Merchant</option>
                        <option value="description">Description</option>
                        <option value="amount">Amount</option>
                        <option value="transaction_type">Type</option>
                    </select>
                    <select 
                        className="border rounded p-2 text-sm"
                        value={formData.criteria?.operator}
                        onChange={(e) => setFormData({ 
                            ...formData, 
                            criteria: { ...formData.criteria!, operator: e.target.value as any } 
                        })}
                    >
                        <option value="equals">Equals</option>
                        <option value="contains">Contains</option>
                        <option value="starts_with">Starts With</option>
                        <option value="ends_with">Ends With</option>
                        <option value="gt">Greater Than</option>
                        <option value="lt">Less Than</option>
                         <option value="regex">Regex</option>
                    </select>
                    <Input 
                         value={formData.criteria?.value}
                         onChange={(e) => setFormData({ 
                            ...formData, 
                            criteria: { ...formData.criteria!, value: e.target.value } 
                        })}
                         placeholder="Value"
                    />
                </div>
              </div>

               <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 text-gray-900">Action (THEN)</h4>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Set Category</label>
                        <Input 
                            value={formData.action?.category || ''}
                            onChange={(e) => setFormData({ 
                                ...formData, 
                                action: { ...formData.action, category: e.target.value } 
                            })}
                            placeholder="e.g. Transport"
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-medium mb-1 text-gray-600">Rename Merchant (Optional)</label>
                        <Input 
                            value={formData.action?.merchantRename || ''}
                            onChange={(e) => setFormData({ 
                                ...formData, 
                                action: { ...formData.action, merchantRename: e.target.value } 
                            })}
                            placeholder="e.g. Uber"
                        />
                    </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRule ? "Save Changes" : "Create Rule"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
