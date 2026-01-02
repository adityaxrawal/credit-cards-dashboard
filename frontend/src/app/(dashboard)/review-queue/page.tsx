import { ReviewQueueClient } from '@/features/review/components/ReviewQueueClient';

export const metadata = {
  title: 'Review Queue | Credit Card Dashboard',
  description: 'Review and approve pending transactions',
};

export default function ReviewQueuePage() {
  return <ReviewQueueClient />;
}
