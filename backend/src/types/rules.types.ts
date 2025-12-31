
export interface ClassificationRule {
    id: string;
    userId: string;
    name: string;
    priority: number;
    isActive: boolean;
    criteria: RuleCriteria;
    action: RuleAction;
    createdAt: Date;
    updatedAt: Date;
}

export type RuleOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'regex';

export interface RuleCriteria {
    field: 'merchant' | 'description' | 'amount' | 'transaction_type';
    operator: RuleOperator;
    value: string | number;
}

export interface RuleAction {
    category?: string;
    merchantRename?: string;
    markAs?: 'transfer' | 'investment' | 'expense' | 'income';
}

export interface RuleMatchResult {
    ruleId: string;
    ruleName: string;
    action: RuleAction;
}
