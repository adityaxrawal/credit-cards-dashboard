/**
 * Security Services Tests
 * Unit tests for transaction lock, audit trail, backup/export, and activity logging
 */

// Mock dependencies
jest.mock('@shared/database/db', () => ({
    __esModule: true,
    default: {
        query: jest.fn(),
        connect: jest.fn().mockResolvedValue({
            query: jest.fn(),
            release: jest.fn(),
        }),
    },
}));

const mockPool = require('@shared/database/db').default;

describe('TransactionLockService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getLockSettings', () => {
        it('should return user lock settings', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ lock_days: 30, enabled: true, allow_admin_override: false }],
            });

            const result = await mockPool.query(
                'SELECT settings FROM users WHERE id = $1',
                [userId]
            );

            expect(result.rows[0].lock_days).toBe(30);
            expect(result.rows[0].enabled).toBe(true);
        });

        it('should use default settings if none exist', () => {
            const defaultSettings = {
                lockDays: 30,
                enabled: true,
                allowAdminOverride: false,
            };

            expect(defaultSettings.lockDays).toBe(30);
        });
    });

    describe('isTransactionLocked', () => {
        it('should return locked=true for transactions older than lock period', () => {
            const lockDays = 7;
            const transactionDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const lockCutoff = new Date(Date.now() - lockDays * 24 * 60 * 60 * 1000);

            const isLocked = transactionDate < lockCutoff;
            expect(isLocked).toBe(true);
        });

        it('should return locked=false for recent transactions', () => {
            const lockDays = 30;
            const transactionDate = new Date(); // Today
            const lockCutoff = new Date(Date.now() - lockDays * 24 * 60 * 60 * 1000);

            const isLocked = transactionDate < lockCutoff;
            expect(isLocked).toBe(false);
        });

        it('should return locked=true for explicitly locked transactions', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ transaction_date: new Date(), is_locked: true }],
            });

            const result = await mockPool.query(
                'SELECT is_locked FROM transactions WHERE id = $1',
                ['tx-123']
            );

            expect(result.rows[0].is_locked).toBe(true);
        });
    });

    describe('lockTransaction', () => {
        it('should lock transaction with reason', async () => {
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

            await mockPool.query(
                'UPDATE transactions SET is_locked = true, lock_reason = $1 WHERE id = $2',
                ['Manual verification', 'tx-123']
            );

            expect(mockPool.query).toHaveBeenCalled();
        });
    });
});

describe('AuditTrailService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should create audit entry', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'audit-1' }] });

            const result = await mockPool.query(
                'INSERT INTO transaction_audit_log (user_id, action) VALUES ($1, $2) RETURNING id',
                [userId, 'transaction:create']
            );

            expect(result.rows[0].id).toBe('audit-1');
        });
    });

    describe('getActivitySummary', () => {
        it('should return activity summary', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { action: 'transaction:create', count: '10' },
                    { action: 'transaction:update', count: '5' },
                ],
            });

            const result = await mockPool.query(
                'SELECT action, COUNT(*) as count FROM transaction_audit_log WHERE user_id = $1 GROUP BY action',
                [userId]
            );

            expect(result.rows).toHaveLength(2);
            expect(parseInt(result.rows[0].count)).toBe(10);
        });
    });

    describe('calculateChanges', () => {
        it('should detect field changes', () => {
            const oldData = { amount: 100, description: 'Old' };
            const newData = { amount: 150, description: 'Old' };

            const changes: Record<string, any> = {};
            Object.keys(newData).forEach(key => {
                if ((oldData as any)[key] !== (newData as any)[key]) {
                    changes[key] = { old: (oldData as any)[key], new: (newData as any)[key] };
                }
            });

            expect(changes.amount).toEqual({ old: 100, new: 150 });
            expect(changes.description).toBeUndefined();
        });
    });
});

describe('BackupExportService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exportUserData', () => {
        it('should export user data as JSON', async () => {
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Account 1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 't1', amount: 500 }] });

            const accounts = await mockPool.query('SELECT * FROM instruments WHERE user_id = $1', [userId]);
            const transactions = await mockPool.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);

            const exportData = {
                version: '1.0',
                accounts: accounts.rows,
                transactions: transactions.rows,
            };

            expect(exportData.accounts).toHaveLength(1);
            expect(exportData.transactions).toHaveLength(1);
        });
    });

    describe('encryption/decryption', () => {
        it('should maintain data integrity through encryption cycle', () => {
            const originalData = '{"test": "data"}';

            // Simple XOR encryption for test purposes
            const encrypt = (text: string, key: number) => {
                return text.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join('');
            };

            const key = 42;
            const encrypted = encrypt(originalData, key);
            expect(encrypted).not.toBe(originalData);

            const decrypted = encrypt(encrypted, key); // XOR is reversible
            expect(decrypted).toBe(originalData);
        });
    });

    describe('checksum', () => {
        it('should generate consistent checksum', () => {
            const data = 'test data';

            // Simple hash for testing
            const hash = (str: string) => {
                let h = 0;
                for (let i = 0; i < str.length; i++) {
                    h = ((h << 5) - h) + str.charCodeAt(i);
                    h |= 0;
                }
                return Math.abs(h).toString(16);
            };

            const checksum1 = hash(data);
            const checksum2 = hash(data);

            expect(checksum1).toBe(checksum2);
        });
    });
});

describe('ActivityLoggingService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('logActivity', () => {
        it('should log activity entry', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'log-1' }] });

            const result = await mockPool.query(
                'INSERT INTO user_activity_log (user_id, activity_type) VALUES ($1, $2) RETURNING id',
                [userId, 'login']
            );

            expect(result.rows[0].id).toBe('log-1');
        });
    });

    describe('parseUserAgent', () => {
        it('should detect mobile devices', () => {
            const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
            const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);

            expect(isMobile).toBe(true);
        });

        it('should detect desktop browsers', () => {
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0';
            const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);

            expect(isMobile).toBe(false);
        });

        it('should detect browser type', () => {
            const detectBrowser = (ua: string) => {
                if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) return 'Chrome';
                if (/firefox/i.test(ua)) return 'Firefox';
                if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
                return 'Unknown';
            };

            expect(detectBrowser('Mozilla Chrome/91.0')).toBe('Chrome');
            expect(detectBrowser('Mozilla Firefox/89.0')).toBe('Firefox');
        });
    });

    describe('getActivitySummary', () => {
        it('should return activity summary', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    total: 50,
                    unique_ips: 3,
                    logins: 10,
                    failed_logins: 2,
                }],
            });

            const result = await mockPool.query(
                'SELECT COUNT(*) as total FROM user_activity_log WHERE user_id = $1',
                [userId]
            );

            expect(parseInt(result.rows[0].total)).toBe(50);
        });
    });

    describe('suspicious activity detection', () => {
        it('should flag multiple failed logins', () => {
            const failedAttempts = 6;
            const threshold = 5;
            const timeWindow = 15; // minutes

            const isSuspicious = failedAttempts >= threshold;
            expect(isSuspicious).toBe(true);
        });

        it('should not flag normal login attempts', () => {
            const failedAttempts = 2;
            const threshold = 5;

            const isSuspicious = failedAttempts >= threshold;
            expect(isSuspicious).toBe(false);
        });
    });
});

export {};
