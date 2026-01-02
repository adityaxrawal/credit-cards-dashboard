import { RuleService, ruleService } from '@modules/rules/rules.service';
import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';

export interface RuleSuggestion {
  merchant: string;
  suggestedCategory: string;
  confidence: number;
  transactionCount: number;
  sampleTransactionId?: string;
  type: 'category_consistency'; // Start with just this type
}

export class RuleSuggestionService {
  /**
   * Generate rule suggestions for a user based on their transaction history
   */
  async generateSuggestions(userId: string): Promise<RuleSuggestion[]> {
    // 1. Get existing rules to exclude already covered merchants
    const existingRules = await ruleService.getRules(userId);
    const coveredMerchants = new Set<string>();

    existingRules.forEach(rule => {
      if (rule.criteria.field === 'merchant' &&
        (rule.criteria.operator === 'contains' || rule.criteria.operator === 'equals')) {
        coveredMerchants.add(String(rule.criteria.value).toLowerCase());
      }
    });

    // 2. Analyze transaction history for consistent categorization
    // We look for merchants with at least 3 transactions, where > 80% are in the same category
    const rows = await TransactionRepository.findCategoryConsistencyStats(userId);

    const suggestions: RuleSuggestion[] = [];

    for (const row of rows) {
      const merchantLower = row.merchant.toLowerCase();

      // Skip if this merchant is drastically simple (e.g. "Uber") and already has a rule
      // Note: This is a simple exact match check, sophisticated overlap checking is harder
      let covered = false;
      for (const coveredMerchant of coveredMerchants) {
        if (merchantLower.includes(coveredMerchant)) {
          covered = true;
          break;
        }
      }

      if (!covered) {
        suggestions.push({
          merchant: row.merchant,
          suggestedCategory: row.category,
          confidence: parseFloat(row.ratio),
          transactionCount: parseInt(row.total_txns),
          sampleTransactionId: row.sample_id,
          type: 'category_consistency'
        });
      }
    }

    return suggestions;
  }
}

export const ruleSuggestionService = new RuleSuggestionService();
