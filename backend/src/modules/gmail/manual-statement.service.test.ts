
import { ManualStatementService } from './manual-statement.service';
import { InstrumentRepository } from '../../repositories/InstrumentRepository';
import { UserProfileService } from '@modules/user/user-profile.service';
// import { BankPDFPasswordResolver } from '@modules/statements/bank-pdf-password-resolver'; // Removed
import { PdfPasswordService } from '@modules/settings/PdfPasswordService';
import { StatementParserFactory } from '@modules/statements/statement-parser-factory';
import { StatementReconciler } from '@modules/statements/statement-reconciler';

// Mocks
jest.mock('../../repositories/InstrumentRepository');
jest.mock('../user/UserProfileService');
jest.mock('@modules/settings/PdfPasswordService'); // Mock the service class
jest.mock('../statements/StatementParserFactory');
jest.mock('../statements/StatementReconciler');
jest.mock('@shared/utils/infrastructure/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

describe('ManualStatementService', () => {
    const userId = 'user123';
    const mockPdfBase64 = Buffer.from('%PDF-1.4 header').toString('base64');

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        (InstrumentRepository.findByUserId as jest.Mock).mockResolvedValue([]);
        (UserProfileService.getPasswordContext as jest.Mock).mockResolvedValue(null);
        // Mock PdfPasswordService method on the prototype
        (PdfPasswordService.prototype.getAllPasswordsForParsing as jest.Mock).mockResolvedValue([]);

        (StatementParserFactory.process as jest.Mock).mockResolvedValue({ bankName: 'TestBank', transactions: [] });
        (StatementReconciler.reconcile as jest.Mock).mockResolvedValue({ totalProcessed: 0, matched: 0, newInserted: 0 });
    });

    it('should inject user profile context into password service', async () => {
        // Arrange
        const mockProfileContext = {
            firstName: 'JOHN',
            fullName: 'JOHN DOE',
            dob: new Date('1990-01-01')
        };
        (UserProfileService.getPasswordContext as jest.Mock).mockResolvedValue(mockProfileContext);

        const mockInstruments = [{ id: 'inst1', last4: '1234' }];
        (InstrumentRepository.findByUserId as jest.Mock).mockResolvedValue(mockInstruments);

        // Act
        await ManualStatementService.processStatement(userId, {
            cardId: 'card1',
            statementMonth: 1,
            statementYear: 2023,
            pdfBase64: mockPdfBase64
        });

        // Assert
        expect(UserProfileService.getPasswordContext).toHaveBeenCalledWith(userId);
        expect(InstrumentRepository.findByUserId).toHaveBeenCalledWith(userId);

        expect(PdfPasswordService.prototype.getAllPasswordsForParsing).toHaveBeenCalledWith(userId,
            expect.objectContaining({
                firstName: 'JOHN',
                dateOfBirth: mockProfileContext.dob,
                instruments: expect.arrayContaining([
                    expect.objectContaining({ account_number_masked: 'XXXXXX1234' })
                ])
            })
        );
    });

    it('should handle missing user profile gracefully', async () => {
        // Arrange
        (UserProfileService.getPasswordContext as jest.Mock).mockResolvedValue(null);
        (InstrumentRepository.findByUserId as jest.Mock).mockResolvedValue([]);

        // Act
        await ManualStatementService.processStatement(userId, {
            cardId: 'card1',
            statementMonth: 1,
            statementYear: 2023,
            pdfBase64: mockPdfBase64
        });

        // Assert
        expect(PdfPasswordService.prototype.getAllPasswordsForParsing).toHaveBeenCalledWith(userId,
            expect.objectContaining({
                firstName: undefined,
                dateOfBirth: undefined,
                instruments: []
            })
        );
    });
});
