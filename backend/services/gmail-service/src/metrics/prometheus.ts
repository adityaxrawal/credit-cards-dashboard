import client from "prom-client";
import express from "express";
import { logger } from "../utils/logger";

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom Metrics

// Email Processing Metrics
export const emailsProcessedTotal = new client.Counter({
  name: "emails_processed_total",
  help: "Total number of emails processed",
  labelNames: ["status", "classification"],
  registers: [register],
});

export const emailProcessingDuration = new client.Histogram({
  name: "email_processing_duration_seconds",
  help: "Email processing duration in seconds",
  labelNames: ["classification"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Classification Metrics
export const classificationConfidence = new client.Histogram({
  name: "classification_confidence",
  help: "Email classification confidence score",
  labelNames: ["classification", "bank"],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

export const classificationsTotal = new client.Counter({
  name: "classifications_total",
  help: "Total number of classifications",
  labelNames: ["classification", "bank"],
  registers: [register],
});

// Extraction Metrics
export const extractionsTotal = new client.Counter({
  name: "extractions_total",
  help: "Total number of transaction extractions",
  labelNames: ["status", "bank", "method"],
  registers: [register],
});

export const extractionConfidence = new client.Histogram({
  name: "extraction_confidence",
  help: "Transaction extraction confidence score",
  labelNames: ["bank", "method"],
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

// Queue Metrics
export const queueDepth = new client.Gauge({
  name: "queue_depth",
  help: "Current queue depth by status",
  labelNames: ["status"],
  registers: [register],
});

export const queueProcessingTime = new client.Histogram({
  name: "queue_processing_time_seconds",
  help: "Time spent processing queue messages",
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const queueRetriesTotal = new client.Counter({
  name: "queue_retries_total",
  help: "Total number of queue message retries",
  labelNames: ["reason"],
  registers: [register],
});

export const queueDLQTotal = new client.Counter({
  name: "queue_dlq_total",
  help: "Total number of messages moved to DLQ",
  labelNames: ["reason"],
  registers: [register],
});

// Scanner Metrics
export const scanJobsTotal = new client.Counter({
  name: "scan_jobs_total",
  help: "Total number of historical scan jobs",
  labelNames: ["status"],
  registers: [register],
});

export const scanProgress = new client.Gauge({
  name: "scan_progress_percentage",
  help: "Current scan job progress percentage",
  labelNames: ["job_id"],
  registers: [register],
});

export const scanMessagesTotal = new client.Counter({
  name: "scan_messages_total",
  help: "Total messages processed in scans",
  labelNames: ["status"],
  registers: [register],
});

// Token Metrics
export const tokenRefreshTotal = new client.Counter({
  name: "token_refresh_total",
  help: "Total number of token refreshes",
  labelNames: ["status"],
  registers: [register],
});

export const tokenEncryptionDuration = new client.Histogram({
  name: "token_encryption_duration_seconds",
  help: "Token encryption/decryption duration",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// Gmail API Metrics
export const gmailAPICallsTotal = new client.Counter({
  name: "gmail_api_calls_total",
  help: "Total Gmail API calls",
  labelNames: ["method", "status"],
  registers: [register],
});

export const gmailAPILatency = new client.Histogram({
  name: "gmail_api_latency_seconds",
  help: "Gmail API call latency",
  labelNames: ["method"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const gmailAPIQuotaUsed = new client.Counter({
  name: "gmail_api_quota_used",
  help: "Gmail API quota units used",
  labelNames: ["method"],
  registers: [register],
});

// Manual Review Metrics
export const manualReviewQueueDepth = new client.Gauge({
  name: "manual_review_queue_depth",
  help: "Number of items in manual review queue",
  registers: [register],
});

export const manualReviewTotal = new client.Counter({
  name: "manual_review_total",
  help: "Total manual review actions",
  labelNames: ["action"],
  registers: [register],
});

// Error Metrics
export const errorsTotal = new client.Counter({
  name: "errors_total",
  help: "Total errors by type",
  labelNames: ["component", "error_type"],
  registers: [register],
});

/**
 * Metrics router - exposes /metrics endpoint
 */
export const metricsRouter = express.Router();

metricsRouter.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error({ error }, "Failed to generate metrics");
    res.status(500).end();
  }
});

/**
 * Update queue metrics periodically
 */
export async function updateQueueMetrics(stats: {
  pending: number;
  processing: number;
  delayed: number;
  dlq: number;
}) {
  queueDepth.set({ status: "pending" }, stats.pending);
  queueDepth.set({ status: "processing" }, stats.processing);
  queueDepth.set({ status: "delayed" }, stats.delayed);
  queueDepth.set({ status: "dlq" }, stats.dlq);
}

/**
 * Record email processing
 */
export function recordEmailProcessing(
  classification: string,
  duration: number,
  success: boolean
) {
  emailsProcessedTotal.inc({
    status: success ? "success" : "failure",
    classification,
  });
  emailProcessingDuration.observe({ classification }, duration);
}

/**
 * Record classification
 */
export function recordClassification(
  classification: string,
  bank: string,
  confidence: number
) {
  classificationsTotal.inc({ classification, bank });
  classificationConfidence.observe({ classification, bank }, confidence);
}

/**
 * Record extraction
 */
export function recordExtraction(
  success: boolean,
  bank: string,
  method: string,
  confidence?: number
) {
  extractionsTotal.inc({
    status: success ? "success" : "failure",
    bank,
    method,
  });
  if (confidence !== undefined) {
    extractionConfidence.observe({ bank, method }, confidence);
  }
}

/**
 * Record Gmail API call
 */
export function recordGmailAPICall(
  method: string,
  duration: number,
  success: boolean,
  quotaUnits: number = 1
) {
  gmailAPICallsTotal.inc({
    method,
    status: success ? "success" : "failure",
  });
  gmailAPILatency.observe({ method }, duration);
  if (success) {
    gmailAPIQuotaUsed.inc({ method }, quotaUnits);
  }
}

/**
 * Record error
 */
export function recordError(component: string, errorType: string) {
  errorsTotal.inc({ component, error_type: errorType });
}

export default register;
