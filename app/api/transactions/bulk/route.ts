import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// BULK operations on transactions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { operation, transactionIds, updateData } = body;

    // Validate required fields
    if (!operation || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ 
        error: 'Operation and transactionIds array are required' 
      }, { status: 400 });
    }

    // Validate transaction IDs format
    const validTransactionIds = transactionIds.filter(id => 
      typeof id === 'string' && id.trim().length > 0
    );

    if (validTransactionIds.length === 0) {
      return NextResponse.json({ 
        error: 'No valid transaction IDs provided' 
      }, { status: 400 });
    }

    // Verify all transactions belong to the user
    const { data: userTransactions, error: verifyError } = await supabase
      .from('current_transactions')
      .select('id')
      .eq('user_id', user.id)
      .in('id', validTransactionIds);

    if (verifyError) {
      console.error('Error verifying transactions:', verifyError);
      return NextResponse.json({ error: 'Failed to verify transactions' }, { status: 500 });
    }

    const verifiedIds = userTransactions.map(t => t.id);
    const unauthorizedIds = validTransactionIds.filter(id => !verifiedIds.includes(id));

    if (unauthorizedIds.length > 0) {
      return NextResponse.json({ 
        error: `Unauthorized or non-existent transaction IDs: ${unauthorizedIds.join(', ')}` 
      }, { status: 403 });
    }

    let result;
    let successCount = 0;
    let failedIds: string[] = [];

    switch (operation) {
      case 'delete':
        // Bulk delete transactions
        const { error: deleteError } = await supabase
          .from('current_transactions')
          .delete()
          .eq('user_id', user.id)
          .in('id', verifiedIds);

        if (deleteError) {
          console.error('Error in bulk delete:', deleteError);
          return NextResponse.json({ error: 'Failed to delete transactions' }, { status: 500 });
        }

        result = {
          operation: 'delete',
          successCount: verifiedIds.length,
          deletedIds: verifiedIds,
          message: `Successfully deleted ${verifiedIds.length} transactions`
        };
        break;

      case 'update':
        // Bulk update transactions
        if (!updateData || typeof updateData !== 'object') {
          return NextResponse.json({ 
            error: 'updateData object is required for update operation' 
          }, { status: 400 });
        }

        // Prepare update data with validation
        const bulkUpdateData: Record<string, string | number | boolean | string[] | null> = {};
        
        if (updateData.category !== undefined) bulkUpdateData.category = updateData.category.trim();
        if (updateData.tags !== undefined) {
          if (!Array.isArray(updateData.tags)) {
            return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
          }
          bulkUpdateData.tags = updateData.tags.filter((tag: string) => tag && tag.trim()).map((tag: string) => tag.trim());
        }
        if (updateData.isRecurring !== undefined) bulkUpdateData.is_recurring = Boolean(updateData.isRecurring);

        // Perform bulk update
        const { data: updatedTransactions, error: updateError } = await supabase
          .from('current_transactions')
          .update(bulkUpdateData)
          .eq('user_id', user.id)
          .in('id', verifiedIds)
          .select('id');

        if (updateError) {
          console.error('Error in bulk update:', updateError);
          return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 });
        }

        successCount = updatedTransactions?.length || 0;
        failedIds = verifiedIds.filter(id => 
          !updatedTransactions?.some(t => t.id === id)
        );

        result = {
          operation: 'update',
          successCount,
          updatedIds: updatedTransactions?.map(t => t.id) || [],
          failedIds,
          updateData: bulkUpdateData,
          message: `Successfully updated ${successCount} transactions`
        };
        break;

      case 'categorize':
        // Bulk categorize transactions
        if (!updateData?.category) {
          return NextResponse.json({ 
            error: 'Category is required for categorize operation' 
          }, { status: 400 });
        }

        const { data: categorizedTransactions, error: categorizeError } = await supabase
          .from('current_transactions')
          .update({ category: updateData.category.trim() })
          .eq('user_id', user.id)
          .in('id', verifiedIds)
          .select('id');

        if (categorizeError) {
          console.error('Error in bulk categorize:', categorizeError);
          return NextResponse.json({ error: 'Failed to categorize transactions' }, { status: 500 });
        }

        successCount = categorizedTransactions?.length || 0;
        failedIds = verifiedIds.filter(id => 
          !categorizedTransactions?.some(t => t.id === id)
        );

        result = {
          operation: 'categorize',
          successCount,
          categorizedIds: categorizedTransactions?.map(t => t.id) || [],
          failedIds,
          category: updateData.category,
          message: `Successfully categorized ${successCount} transactions as "${updateData.category}"`
        };
        break;

      case 'tag':
        // Bulk add tags to transactions
        if (!updateData?.tags || !Array.isArray(updateData.tags)) {
          return NextResponse.json({ 
            error: 'Tags array is required for tag operation' 
          }, { status: 400 });
        }

        const newTags = updateData.tags.filter((tag: string) => tag && tag.trim()).map((tag: string) => tag.trim());
        if (newTags.length === 0) {
          return NextResponse.json({ 
            error: 'At least one valid tag is required' 
          }, { status: 400 });
        }

        // Get current transactions to merge tags
        const { data: currentTransactions, error: fetchError } = await supabase
          .from('current_transactions')
          .select('id, tags')
          .eq('user_id', user.id)
          .in('id', verifiedIds);

        if (fetchError) {
          console.error('Error fetching current transactions:', fetchError);
          return NextResponse.json({ error: 'Failed to fetch current transactions' }, { status: 500 });
        }

        // Update each transaction with merged tags
        const tagUpdates = currentTransactions.map(transaction => {
          const existingTags = transaction.tags || [];
          const mergedTags = [...new Set([...existingTags, ...newTags])]; // Remove duplicates
          return supabase
            .from('current_transactions')
            .update({ tags: mergedTags })
            .eq('id', transaction.id)
            .eq('user_id', user.id);
        });

        const tagResults = await Promise.allSettled(tagUpdates);
        const successfulTags = tagResults.filter(result => result.status === 'fulfilled').length;
        const failedTags = tagResults.filter(result => result.status === 'rejected').length;

        result = {
          operation: 'tag',
          successCount: successfulTags,
          failedCount: failedTags,
          addedTags: newTags,
          message: `Successfully added tags to ${successfulTags} transactions`
        };
        break;

      default:
        return NextResponse.json({ 
          error: 'Invalid operation. Supported operations: delete, update, categorize, tag' 
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      ...result,
      totalRequested: validTransactionIds.length,
      unauthorizedIds: unauthorizedIds.length > 0 ? unauthorizedIds : undefined
    });

  } catch (error) {
    console.error('Unexpected error in bulk transactions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}