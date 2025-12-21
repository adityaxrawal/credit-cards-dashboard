import logger from '../../utils/logger';

/**
 * Setup and teardown for E2E tests
 */

beforeAll(async () => {
    logger.info('[E2E Tests] Setting up E2E test environment');
});

afterAll(async () => {
    logger.info('[E2E Tests] Tearing down E2E test environment');
});
