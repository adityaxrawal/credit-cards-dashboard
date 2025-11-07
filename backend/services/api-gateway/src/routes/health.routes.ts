import { Router } from "express";

const router = Router();

// Deprecated: Forward to unified monitoring health endpoint
router.get("/", (_req, res) => {
  res.redirect(301, "/api/monitoring/health");
});

export default router;
