import pool from '../lib/db';
import * as analyticsService from '../services/analytics/AnalyticsService';

/**
 * Analytics Compute Job
 * Runs daily to pre-compute analytics for all users
 */
export async function runAnalyticsComputeJob() {
  console.log('[AnalyticsComputeJob] Starting...');
  
  try {
    // Get all active users
    const { rows: users } = await pool.query(
      'SELECT id FROM users WHERE is_active = true'
    );
    
    console.log(`[AnalyticsComputeJob] Processing ${users.length} users`);
    
    for (const user of users) {
      try {
        // Invalidate old cache
        await analyticsService.invalidateCache(user.id);
        
        // Pre-compute overview
        await analyticsService.getOverview(user.id);
        
        // Pre-compute category breakdown
        await analyticsService.getCategoryBreakdown(user.id);
        
        // Pre-compute trends
        await analyticsService.getTrends(user.id, 6);
        
        console.log(`[AnalyticsComputeJob] Computed analytics for user ${user.id}`);
      } catch (error) {
        console.error(`[AnalyticsComputeJob] Error processing user ${user.id}:`, error);
      }
    }
    
    console.log('[AnalyticsComputeJob] Completed');
  } catch (error) {
    console.error('[AnalyticsComputeJob] Job failed:', error);
  }
}

// If run directly
if (require.main === module) {
  runAnalyticsComputeJob()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
