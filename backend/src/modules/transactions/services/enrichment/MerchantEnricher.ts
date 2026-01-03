
import { FuzzyMatcher } from '@shared/utils/text/FuzzyMatcher';
import { MerchantRepository } from '../../repositories/MerchantRepository';
import { ExtractionCandidate } from '../extraction/MerchantExtractor';

export interface EnrichedMerchant {
    canonicalName: string;
    category: string;
    confidence: number;
    original: string;
    isMerchant: boolean;
    merchantId?: string;
    matchType?: 'exact' | 'fuzzy' | 'none';
}

export class MerchantEnricherService {
    private repo: MerchantRepository;

    constructor() {
        this.repo = new MerchantRepository();
    }

    /**
     * Attempts to resolve a raw extraction candidate to a known merchant using DB.
     * Overloaded to accept string for backward compatibility.
     */
    async enrich(input: ExtractionCandidate | string): Promise<EnrichedMerchant> {
        let candidate: ExtractionCandidate;

        if (typeof input === 'string') {
            candidate = { rawName: input, confidence: 0.0, source: 'legacy_extractor' }; // Low confidence for legacy strings
        } else {
            candidate = input;
        }

        const raw = candidate.rawName;
        const extractionConf = candidate.confidence;

        if (!raw) {
            return {
                canonicalName: '',
                category: 'Uncategorized',
                confidence: 0,
                original: '',
                isMerchant: false,
                matchType: 'none'
            };
        }

        // 1. Exact Match via DB (Fastest)
        const exactMatch = await this.repo.findExactAlias(raw);
        if (exactMatch) {
            const matchQuality = 1.0;
            const finalScore = this.calculateScore(extractionConf, matchQuality);

            return {
                canonicalName: exactMatch.merchant_name,
                category: exactMatch.default_category,
                confidence: finalScore,
                original: raw,
                isMerchant: true,
                merchantId: exactMatch.merchant_id,
                matchType: 'exact'
            };
        }

        // 2. Fuzzy Match via DB (Slower)
        const potentialMatches = await this.repo.findPotentialMatches(raw);
        let bestMatch = null;
        let bestScore = 0;

        for (const match of potentialMatches) {
            const ratio = FuzzyMatcher.ratio(raw.toLowerCase(), match.alias.toLowerCase());
            const penalty = parseFloat(match.confidence_penalty) || 0;
            const adjustedQuality = ratio - penalty;

            if (adjustedQuality > bestScore && adjustedQuality > 0.8) {
                bestScore = adjustedQuality;
                bestMatch = match;
            }
        }

        if (bestMatch && bestScore > 0.8) {
            const finalScore = this.calculateScore(extractionConf, bestScore);
            return {
                canonicalName: bestMatch.merchant_name,
                category: bestMatch.default_category,
                confidence: finalScore,
                original: raw,
                isMerchant: true,
                merchantId: bestMatch.merchant_id,
                matchType: 'fuzzy'
            };
        }

        // 3. Fallback (Uncategorized)
        return {
            canonicalName: this.capitalize(raw),
            category: 'Uncategorized',
            confidence: extractionConf * 0.4,
            original: raw,
            isMerchant: true,
            matchType: 'none'
        };
    }

    private calculateScore(extractionConf: number, matchQuality: number): number {
        // If extraction confidence is 0 (legacy), rely solely on match quality but cap it?
        // Or blindly trust exact matches?
        // Strategy: If legacy (0.0), treat MatchQuality as the score directly (0.8 * 1.0) approx?
        // Let's stick to formula but handle 0 case.

        let eConf = extractionConf;
        if (eConf === 0) eConf = 0.5; // Assume medium confidence for legacy extractions if not specified

        return parseFloat(((eConf * 0.4) + (matchQuality * 0.6)).toFixed(2));
    }

    private capitalize(s: string): string {
        if (!s) return '';
        return s.replace(/\b\w/g, c => c.toUpperCase());
    }
}

export const MerchantEnricher = new MerchantEnricherService();
