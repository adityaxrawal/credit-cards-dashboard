import { Router } from 'express';
import {
  getBills,
  payBill,
  generateBill,
  getBillCalendar,
  getReminders,
  createReminder,
  markReminderPaid,
  getRecurringTemplates,
  detectRecurringBills
} from '../controllers/billController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getBills);
router.post('/:id/pay', payBill);
router.post('/generate', generateBill);

// New Routes
router.get('/calendar', getBillCalendar);
router.get('/reminders', getReminders);
router.post('/reminders', createReminder);
router.put('/reminders/:id/paid', markReminderPaid);
router.get('/recurring-templates', getRecurringTemplates);
router.post('/detect-recurring', detectRecurringBills);

export default router;
