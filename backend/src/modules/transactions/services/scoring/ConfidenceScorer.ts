/**
 * ConfidenceScorer - New Architecture Transaction Detection
 * 
 * Implements weighted confidence scoring system:
 * +0.4 authoritative source
 * +0.2 instrument detected
 * +0.2 amount detected
 * +0.1 timestamp detected
 * +0.1 reference ID detected
 * −0.3 ambiguity penalty
 * −0.3 OCR uncertainty
 * −0.2 contradictory signals
 */

import { ConfidenceDetails, ManualReviewReason, ManualReviewTrigger, SourceType } from '@shared/types/transaction.types';
import * as crypto from 'crypto';

export interface SignalDetection {
    authoritativeSource: boolean;
    sourceType?: SourceType;
    instrumentDetected: boolean;
    amountDetected: boolean;
    timestampDetected: boolean;
    referenceIdDetected: boolean;
    ambiguity: boolean;
    ocrUncertainty: boolean;
    ocrConfidenceScore?: number;
    contradictorySignals: boolean;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export class ConfidenceScorer {
    // Scoring weights as per spec
    private static readonly WEIGHTS = {
        AUTHORITATIVE_SOURCE: 0.4,
        INSTRUMENT_DETECTED: 0.2,
        AMOUNT_DETECTED: 0.2,
        TIMESTAMP_DETECTED: 0.1,
        REFERENCE_ID_DETECTED: 0.1,
        AMBIGUITY_PENALTY: -0.3,
        OCR_UNCERTAINTY_PENALTY: -0.3,
        CONTRADICTORY_SIGNALS_PENALTY: -0.2,
    };

    // Thresholds as per spec
    private static readonly THRESHOLDS = {
        HIGH: 0.85,
        MEDIUM: 0.6,
    };

    /**
     * Calculate confidence score and details from detected signals
     */
    static calculate(signals: SignalDetection): ConfidenceDetails {
        let score = 0;

        // Positive signals
        if (signals.authoritativeSource) {
            score += this.WEIGHTS.AUTHORITATIVE_SOURCE;
        }
        if (signals.instrumentDetected) {
            score += this.WEIGHTS.INSTRUMENT_DETECTED;
        }
        if (signals.amountDetected) {
            score += this.WEIGHTS.AMOUNT_DETECTED;
        }
        if (signals.timestampDetected) {
            score += this.WEIGHTS.TIMESTAMP_DETECTED;
        }
        if (signals.referenceIdDetected) {
            score += this.WEIGHTS.REFERENCE_ID_DETECTED;
        }

        // Negative signals
        if (signals.ambiguity) {
            score += this.WEIGHTS.AMBIGUITY_PENALTY;
        }
        if (signals.ocrUncertainty) {
            score += this.WEIGHTS.OCR_UNCERTAINTY_PENALTY;
        }
        if (signals.contradictorySignals) {
            score += this.WEIGHTS.CONTRADICTORY_SIGNALS_PENALTY;
        }

        // Clamp score between 0 and 1
        score = Math.max(0, Math.min(1, score));

        return {
            score,
            authoritative_source: signals.authoritativeSource,
            instrument_detected: signals.instrumentDetected,
            amount_detected: signals.amountDetected,
            timestamp_detected: signals.timestampDetected,
            reference_id_detected: signals.referenceIdDetected,
            ambiguity_penalty: signals.ambiguity,
            ocr_uncertainty: signals.ocrUncertainty,
            contradictory_signals: signals.contradictorySignals,
        };
    }

    /**
     * Get confidence level classification from score
     */
    static getConfidenceLevel(score: number): ConfidenceLevel {
        if (score >= this.THRESHOLDS.HIGH) return 'high';
        if (score >= this.THRESHOLDS.MEDIUM) return 'medium';
        return 'low';
    }

    /**
     * Determine if manual review is required based on confidence and signals
     */
    static requiresManualReview(
        confidenceDetails: ConfidenceDetails,
        signals: SignalDetection
    ): { required: boolean; triggers: ManualReviewTrigger[] } {
        const triggers: ManualReviewTrigger[] = [];

        // Low confidence score trigger
        if (this.getConfidenceLevel(confidenceDetails.score) === 'low') {
            triggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.LOW_CONFIDENCE_SCORE,
                details: `Confidence score ${(confidenceDetails.score * 100).toFixed(1)}% is below threshold`,
            });
        }

        // Missing amount
        if (!signals.amountDetected) {
            triggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.MISSING_AMOUNT,
                details: 'No monetary amount could be extracted',
            });
        }

        // Missing instrument
        if (!signals.instrumentDetected) {
            triggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.MISSING_INSTRUMENT,
                details: 'No payment instrument could be identified',
            });
        }

        // OCR low confidence
        if (signals.ocrUncertainty && signals.ocrConfidenceScore !== undefined && signals.ocrConfidenceScore < 0.7) {
            triggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.OCR_LOW_CONFIDENCE,
                details: `OCR confidence ${(signals.ocrConfidenceScore * 100).toFixed(1)}% is below threshold`,
            });
        }

        // Contradictory signals
        if (signals.contradictorySignals) {
            triggers.push({
                id: crypto.randomUUID(),
                reason: ManualReviewReason.CONFLICTING_DIRECTION,
                details: 'Conflicting debit/credit signals detected',
            });
        }

        return {
            required: triggers.length > 0,
            triggers,
        };
    }

    /**
     * Create a default high-confidence details object
     */
    static createHighConfidence(): ConfidenceDetails {
        return {
            score: 1.0,
            authoritative_source: true,
            instrument_detected: true,
            amount_detected: true,
            timestamp_detected: true,
            reference_id_detected: true,
            ambiguity_penalty: false,
            ocr_uncertainty: false,
            contradictory_signals: false,
        };
    }

    /**
     * Create a default low-confidence details object
     */
    static createLowConfidence(reason?: string): ConfidenceDetails {
        return {
            score: 0.2,
            authoritative_source: false,
            instrument_detected: false,
            amount_detected: false,
            timestamp_detected: false,
            reference_id_detected: false,
            ambiguity_penalty: true,
            ocr_uncertainty: false,
            contradictory_signals: false,
        };
    }
}
