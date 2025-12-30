/**
 * Rewards Controller Tests
 * Tests for rewards management API endpoints
 */

import { Request, Response, NextFunction } from 'express';

// Mock dependencies
jest.mock('../../services/rewards/RewardCalculationService', () => ({
    __esModule: true,
    RewardCalculationService: {
        getRules: jest.fn(),
        createRule: jest.fn(),
        deleteRule: jest.fn(),
        toggleRule: jest.fn(),
        calculateReward: jest.fn(),
    },
}));

jest.mock('../../utils/infrastructure/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

import * as rewardsController from '../../controllers/rewards.controller';
import { RewardCalculationService } from '../../services/rewards/RewardCalculationService';

const mockRewardService = RewardCalculationService as jest.Mocked<typeof RewardCalculationService>;

describe('Rewards Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            user: { id: 'user-123' },
            params: {},
            query: {},
            body: {},
        };
        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('listRewardRules', () => {
        it('should return list of reward rules', async () => {
            const mockRules = [
                { id: 'rule-1', ruleName: '2x on Dining', rate: 2 },
                { id: 'rule-2', ruleName: '5% Cashback Shopping', rate: 5 },
            ];
            mockRewardService.getRules.mockResolvedValue(mockRules);

            await rewardsController.listRewardRules(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({ data: mockRules });
        });

        it('should handle errors', async () => {
            mockRewardService.getRules.mockRejectedValue(new Error('DB Error'));

            await rewardsController.listRewardRules(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('createRewardRule', () => {
        it('should create a new reward rule', async () => {
            mockReq.body = {
                ruleName: '10x on Travel',
                category: 'Travel',
                rewardType: 'points',
                rate: 10,
                rateType: 'multiplier',
            };
            mockRewardService.createRule.mockResolvedValue({
                id: 'new-rule',
                ...mockReq.body,
            });

            await rewardsController.createRewardRule(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ id: 'new-rule' }),
            });
        });

        it('should validate required fields', async () => {
            mockReq.body = { rate: 5 }; // Missing ruleName, rewardType

            await rewardsController.createRewardRule(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('deleteRewardRule', () => {
        it('should delete reward rule', async () => {
            mockReq.params = { id: 'rule-1' };
            mockRewardService.deleteRule.mockResolvedValue(true);

            await rewardsController.deleteRewardRule(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(204);
        });

        it('should return 404 for non-existent rule', async () => {
            mockReq.params = { id: 'non-existent' };
            mockRewardService.deleteRule.mockResolvedValue(false);

            await rewardsController.deleteRewardRule(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('toggleRewardRule', () => {
        it('should toggle rule active status', async () => {
            mockReq.params = { id: 'rule-1' };
            mockReq.body = { isActive: false };
            mockRewardService.toggleRule.mockResolvedValue({
                id: 'rule-1',
                isActive: false,
            });

            await rewardsController.toggleRewardRule(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ isActive: false }),
            });
        });
    });


});
