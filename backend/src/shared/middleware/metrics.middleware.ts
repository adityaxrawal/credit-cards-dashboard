import { Request, Response, NextFunction } from 'express';
import { metricsService } from '@modules/analytics/metrics.service';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationMs = (diff[0] * 1000) + (diff[1] / 1e6);

        metricsService.trackRequest(durationMs);

        if (res.statusCode >= 400) {
            metricsService.trackError();
        }
    });

    next();
};
