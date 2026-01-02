
import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/api/client";

export interface RuleCriteria {
    field: 'merchant' | 'description' | 'amount' | 'transaction_type';
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'regex';
    value: string | number;
}

export interface RuleAction {
    category?: string;
    merchantRename?: string;
    markAs?: 'transfer' | 'investment' | 'expense' | 'income';
}

export interface ClassificationRule {
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
    criteria: RuleCriteria;
    action: RuleAction;
    createdAt: string;
}

export const rulesApi = {
    getRules: async (): Promise<ClassificationRule[]> => {
        return apiGet<{ data: ClassificationRule[] }>("/api/rules").then((res) => res.data);
    },

    createRule: async (data: Partial<ClassificationRule>): Promise<ClassificationRule> => {
        return apiPost<{ data: ClassificationRule }>("/api/rules", data).then((res) => res.data);
    },

    updateRule: async (id: string, data: Partial<ClassificationRule>): Promise<ClassificationRule> => {
        return apiPut<{ data: ClassificationRule }>(`/api/rules/${id}`, data).then((res) => res.data);
    },

    deleteRule: async (id: string): Promise<void> => {
        await apiDelete<void>(`/api/rules/${id}`);
    },
};
