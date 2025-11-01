import { Router } from "express";
import { authenticate } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// TODO: Implement budget routes in Phase 1

export default router;
