import { ReviewQueueClient } from '@/components/features/review/ReviewQueueClient';

export const metadata = {
  title: 'Review Queue | Credit Card Dashboard',
  description: 'Review and approve pending transactions',
};

export default function ReviewQueuePage() {
  return <ReviewQueueClient />;
}
