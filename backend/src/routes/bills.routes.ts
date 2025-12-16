
import { Router } from 'express';

const router = Router();

// GET /api/bills/upcoming
router.get('/upcoming', (req, res) => {
    // Stub response to prevent 404 errors
    res.json({
        data: [],
        message: 'Bills feature coming soon'
    });
});

export default router;
