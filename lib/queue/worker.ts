import { Redis } from '@upstash/redis';
import { Client } from '@upstash/qstash';
import { v4 as uuidv4 } from 'uuid';

// Initialize Redis and QStash clients
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

// Job types
export type JobType = 'initial-sync' | 'process-email' | 'fetch-perks' | 'check-spending-limits';

// Job data interfaces
export interface InitialSyncJobData {
  yearsBack?: number;
  forceRefresh?: boolean;
}

export interface ProcessEmailJobData {
  messageId: string;
  historyId?: string;
}

export interface FetchPerksJobData {
  cardId: string;
  cardType?: string;
}

export interface CheckSpendingLimitsJobData {
  transactionId?: string;
  category?: string;
}

export type JobData = InitialSyncJobData | ProcessEmailJobData | FetchPerksJobData | CheckSpendingLimitsJobData | Record<string, unknown>;

// Job interface
export interface Job {
  id: string;
  type: JobType;
  userId: string;
  data: JobData;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// JobQueue class
export class JobQueue {
  /**
   * Enqueue a new job
   */
  async enqueue(type: JobType, userId: string, data: JobData = {}): Promise<string> {
    try {
      // Generate unique job ID
      const jobId = uuidv4();
      
      // Create job object
      const job: Job = {
        id: jobId,
        type,
        userId,
        data,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
      };

      // Store job in Redis
      await redis.set(`job:${jobId}`, JSON.stringify(job));
      
      // Add to queue
      await redis.lpush(`queue:${type}`, jobId);
      
      // Trigger worker via QStash
      const workerEndpoint = `${process.env.NEXT_PUBLIC_APP_URL}/api/workers/${type}`;
      
      await qstash.publishJSON({
        url: workerEndpoint,
        body: {
          jobId,
          userId,
          data,
        },
        delay: 1, // Small delay to ensure job is stored
      });

      return jobId;
    } catch (error) {
      console.error('Failed to enqueue job:', error);
      throw new Error(`Failed to enqueue ${type} job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const jobData = await redis.get(`job:${jobId}`);
      
      if (!jobData) {
        return null;
      }

      const job = JSON.parse(jobData as string) as Job;
      
      // Convert date strings back to Date objects
      job.createdAt = new Date(job.createdAt);
      if (job.startedAt) job.startedAt = new Date(job.startedAt);
      if (job.completedAt) job.completedAt = new Date(job.completedAt);

      return job;
    } catch (error) {
      console.error('Failed to get job:', error);
      throw new Error(`Failed to get job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update job with new data
   */
  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    try {
      const currentJob = await this.getJob(jobId);
      
      if (!currentJob) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Merge updates with current job
      const updatedJob: Job = {
        ...currentJob,
        ...updates,
      };

      // Store updated job back to Redis
      await redis.set(`job:${jobId}`, JSON.stringify(updatedJob));
    } catch (error) {
      console.error('Failed to update job:', error);
      throw new Error(`Failed to update job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get jobs by user ID
   */
  async getUserJobs(userId: string, limit: number = 10): Promise<Job[]> {
    try {
      // Get all job keys
      const keys = await redis.keys('job:*');
      const jobs: Job[] = [];

      // Fetch jobs in batches
      for (const key of keys) {
        const jobData = await redis.get(key);
        if (jobData) {
          const job = JSON.parse(jobData as string) as Job;
          if (job.userId === userId) {
            // Convert date strings back to Date objects
            job.createdAt = new Date(job.createdAt);
            if (job.startedAt) job.startedAt = new Date(job.startedAt);
            if (job.completedAt) job.completedAt = new Date(job.completedAt);
            
            jobs.push(job);
          }
        }
      }

      // Sort by creation date (newest first) and limit
      return jobs
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get user jobs:', error);
      throw new Error(`Failed to get jobs for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete completed jobs older than specified days
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const keys = await redis.keys('job:*');
      let deletedCount = 0;

      for (const key of keys) {
        const jobData = await redis.get(key);
        if (jobData) {
          const job = JSON.parse(jobData as string) as Job;
          const jobDate = new Date(job.completedAt || job.createdAt);
          
          if (job.status === 'completed' && jobDate < cutoffDate) {
            await redis.del(key);
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
      throw new Error(`Failed to cleanup old jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();