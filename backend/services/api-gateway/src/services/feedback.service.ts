/**
 * Feedback Service - Collect and manage user feedback
 * Phase 6: Post-Launch & Optimization
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../monitoring/logger';
import { analyticsService } from '../../analytics-service/src/analytics.service';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface Feedback {
  id?: string;
  userId: string;
  feedbackType: 'bug' | 'feature' | 'improvement' | 'general' | 'complaint';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  pageUrl?: string;
  browserInfo?: any;
  screenshotUrl?: string;
}

export interface FeatureRequest {
  id?: string;
  userId: string;
  title: string;
  description: string;
  useCase?: string;
  expectedBehavior?: string;
  alternativesConsidered?: string;
}

export interface NPSSurvey {
  userId: string;
  score: number; // 0-10
  feedback?: string;
  followUpAllowed?: boolean;
}

export class FeedbackService {
  /**
   * Submit user feedback
   */
  async submitFeedback(feedback: Feedback): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: feedback.userId,
          feedback_type: feedback.feedbackType,
          priority: feedback.priority || 'medium',
          title: feedback.title,
          description: feedback.description,
          page_url: feedback.pageUrl,
          browser_info: feedback.browserInfo,
          screenshot_url: feedback.screenshotUrl,
          status: 'submitted',
        })
        .select()
        .single();

      if (error) throw error;

      // Track event
      await analyticsService.trackEvent(feedback.userId, 'feedback_submitted', {
        feedbackType: feedback.feedbackType,
        feedbackId: data.id,
      });

      logger.info('Feedback submitted', {
        userId: feedback.userId,
        feedbackId: data.id,
        type: feedback.feedbackType,
      });

      return data;
    } catch (error: any) {
      logger.error('Failed to submit feedback', error, {
        userId: feedback.userId,
      });
      throw error;
    }
  }

  /**
   * Submit feature request
   */
  async submitFeatureRequest(request: FeatureRequest): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('feature_requests')
        .insert({
          user_id: request.userId,
          title: request.title,
          description: request.description,
          use_case: request.useCase,
          expected_behavior: request.expectedBehavior,
          alternatives_considered: request.alternativesConsidered,
          status: 'under_review',
        })
        .select()
        .single();

      if (error) throw error;

      await analyticsService.trackEvent(request.userId, 'feature_request_submitted', {
        requestId: data.id,
      });

      logger.info('Feature request submitted', {
        userId: request.userId,
        requestId: data.id,
      });

      return data;
    } catch (error: any) {
      logger.error('Failed to submit feature request', error, {
        userId: request.userId,
      });
      throw error;
    }
  }

  /**
   * Submit NPS survey
   */
  async submitNPSSurvey(survey: NPSSurvey): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('nps_surveys')
        .insert({
          user_id: survey.userId,
          score: survey.score,
          feedback: survey.feedback,
          follow_up_allowed: survey.followUpAllowed !== false,
        })
        .select()
        .single();

      if (error) throw error;

      await analyticsService.trackEvent(survey.userId, 'nps_survey_submitted', {
        score: survey.score,
      });

      logger.info('NPS survey submitted', {
        userId: survey.userId,
        score: survey.score,
      });

      return data;
    } catch (error: any) {
      logger.error('Failed to submit NPS survey', error, {
        userId: survey.userId,
      });
      throw error;
    }
  }

  /**
   * Upvote feedback
   */
  async upvoteFeedback(feedbackId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('feedback_upvotes')
        .insert({
          feedback_id: feedbackId,
          user_id: userId,
        });

      if (error) {
        // Already upvoted, remove upvote
        if (error.code === '23505') {
          await supabase
            .from('feedback_upvotes')
            .delete()
            .eq('feedback_id', feedbackId)
            .eq('user_id', userId);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      logger.error('Failed to upvote feedback', error, {
        feedbackId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user feedback list
   */
  async getUserFeedback(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get user feedback', error, { userId });
      throw error;
    }
  }

  /**
   * Get all feedback (admin)
   */
  async getAllFeedback(filters?: {
    status?: string;
    type?: string;
    priority?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('user_feedback')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.type) {
        query = query.eq('feedback_type', filters.type);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error: any) {
      logger.error('Failed to get all feedback', error);
      throw error;
    }
  }

  /**
   * Update feedback status (admin)
   */
  async updateFeedbackStatus(
    feedbackId: string,
    status: string,
    adminNotes?: string,
    resolvedBy?: string
  ): Promise<void> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (adminNotes) {
        updates.admin_notes = adminNotes;
      }

      if (status === 'resolved' && resolvedBy) {
        updates.resolved_by = resolvedBy;
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('user_feedback')
        .update(updates)
        .eq('id', feedbackId);

      if (error) throw error;

      logger.info('Feedback status updated', {
        feedbackId,
        status,
        resolvedBy,
      });
    } catch (error: any) {
      logger.error('Failed to update feedback status', error, { feedbackId });
      throw error;
    }
  }

  /**
   * Add comment to feedback
   */
  async addComment(
    feedbackId: string,
    userId: string,
    comment: string,
    isAdminResponse: boolean = false
  ): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('feedback_comments')
        .insert({
          feedback_id: feedbackId,
          user_id: userId,
          comment,
          is_admin_response: isAdminResponse,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error: any) {
      logger.error('Failed to add comment', error, { feedbackId, userId });
      throw error;
    }
  }

  /**
   * Get feedback statistics (admin)
   */
  async getFeedbackStats(): Promise<any> {
    try {
      const { data: feedbackData } = await supabase
        .from('user_feedback')
        .select('feedback_type, status, priority');

      const { data: npsData } = await supabase
        .from('nps_surveys')
        .select('score');

      // Calculate NPS
      let promoters = 0,
        passives = 0,
        detractors = 0;
      if (npsData) {
        npsData.forEach((survey) => {
          if (survey.score >= 9) promoters++;
          else if (survey.score >= 7) passives++;
          else detractors++;
        });
      }

      const totalNPS = promoters + passives + detractors;
      const npsScore = totalNPS > 0 ? ((promoters - detractors) / totalNPS) * 100 : 0;

      // Group feedback by type and status
      const byType = feedbackData?.reduce((acc, item) => {
        acc[item.feedback_type] = (acc[item.feedback_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const byStatus = feedbackData?.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: feedbackData?.length || 0,
        byType,
        byStatus,
        nps: {
          score: npsScore.toFixed(1),
          promoters,
          passives,
          detractors,
          total: totalNPS,
        },
      };
    } catch (error: any) {
      logger.error('Failed to get feedback stats', error);
      throw error;
    }
  }
}

export const feedbackService = new FeedbackService();
