
"use client";

import React from "react";
import { Zap, X, Check, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// We need a rule suggestion API hook. For now using fetch directly or extending transactionApi
// Assuming GET /api/rules/suggestions exists
import { apiGet, apiPost } from "@/lib/api/client";

interface RuleSuggestion {
  merchant: string;
  suggestedCategory: string;
  confidence: number;
  transactionCount: number;
}

export function RuleSuggestionsPanel() {
  const [isVisible, setIsVisible] = React.useState(true);
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['rule-suggestions'],
    queryFn: async () => {
       const res = await apiGet<{ data: RuleSuggestion[] }>('/api/rules/suggestions');
       return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const createRuleMutation = useMutation({
    mutationFn: async (suggestion: RuleSuggestion) => {
        // Create rule API call
        // Assuming POST /api/rules
        return apiPost('/api/rules', {
            name: `Auto-categorize ${suggestion.merchant}`,
            criteria: { field: "merchant", operator: "contains", value: suggestion.merchant },
            action: { category: suggestion.suggestedCategory },
            priority: 10
        });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['rule-suggestions'] });
        // Also invalidate transactions to reflect potential re-categorization if backend does it?
        // Note: Creating a rule alone doesn't retroactively apply unless we trigger it.
    }
  });

  if (!isVisible || isLoading || suggestions.length === 0) return null;

  const topSuggestion = suggestions[0];

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2">
            <button onClick={() => setIsVisible(false)} className="text-secondary-text hover:text-primary-text">
                <X className="w-4 h-4" />
            </button>
        </div>
        
        <div className="flex gap-4 items-start pr-8">
            <div className="bg-primary/20 p-2 rounded-full text-primary mt-1">
                <Zap className="w-5 h-5" />
            </div>
            
            <div className="flex-1">
                <h4 className="font-semibold text-primary-text flex items-center gap-2">
                    Optimization Detected
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                        {Math.round(topSuggestion.confidence * 100)}% Match
                    </span>
                </h4>
                <p className="text-sm text-secondary-text mt-1">
                    We found <strong>{topSuggestion.transactionCount} transactions</strong> from 
                    <span className="font-medium text-primary-text"> "{topSuggestion.merchant}"</span> grouped as 
                    <span className="font-medium text-primary-text"> "{topSuggestion.suggestedCategory}"</span>.
                </p>
                <p className="text-sm text-secondary-text mt-0.5">
                    Create a rule to automate this?
                </p>
                
                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={() => createRuleMutation.mutate(topSuggestion)}
                        disabled={createRuleMutation.isPending}
                        className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        {createRuleMutation.isPending ? 'Saving...' : (
                            <>
                                <Check className="w-4 h-4" />
                                Create Rule
                            </>
                        )}
                    </button>
                    <button 
                        // Implementation for "Ignore" could be flagging in local storage or backend
                        onClick={() => setIsVisible(false)}
                        className="text-secondary-text hover:text-primary-text text-sm font-medium px-2 py-1.5"
                    >
                        Ignore
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
