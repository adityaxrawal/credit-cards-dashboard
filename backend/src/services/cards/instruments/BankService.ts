import { BankRepository } from '../../../repositories/BankRepository';
import { Bank, UUID } from '../../../types/instruments.types';

export class BankService {
    private static bankCache: Map<string, Bank> = new Map();

    // List all banks in system
    static async getAllBanks(): Promise<Bank[]> {
        if (this.bankCache.size === 0) {
            const banks = await BankRepository.findAll();
            banks.forEach(b => this.bankCache.set(b.name, b));
        }
        return Array.from(this.bankCache.values());
    }

    // Get or create bank by name
    static async getOrCreateBank(bankName: string): Promise<Bank> {
        const existing = await this.findBankByName(bankName);
        if (existing) return existing;

        // Use code-first lookup for common banks
        const bankCode = this.deriveBankCode(bankName);

        const bank = await BankRepository.create({
            name: bankName,
            code: bankCode,
            isActive: true
        });

        this.bankCache.set(bank.name, bank);
        return bank;
    }

    // Get bank by ID
    static async getBankById(bankId: UUID): Promise<Bank | null> {
        return BankRepository.findById(bankId);
    }

    // Register new bank (admin only)
    static async registerBank(data: Partial<Bank>): Promise<Bank> {
        const bank = await BankRepository.create(data);
        this.bankCache.set(bank.name, bank);
        return bank;
    }

    private static async findBankByName(name: string): Promise<Bank | null> {
        // Try cache first
        for (const bank of this.bankCache.values()) {
            if (bank.name.toLowerCase() === name.toLowerCase()) return bank;
        }

        const bank = await BankRepository.findByName(name);
        if (bank) this.bankCache.set(bank.name, bank);
        return bank;
    }

    private static deriveBankCode(bankName: string): string {
        const name = bankName.toUpperCase();
        if (name.includes('HDFC')) return 'HDFC';
        if (name.includes('ICICI')) return 'ICICI';
        if (name.includes('AXIS')) return 'AXIS';
        if (name.includes('SBI') || name.includes('STATE BANK')) return 'SBI';
        if (name.includes('KOTAK')) return 'KOTAK';
        return name.substring(0, 5).replace(/\s/g, '');
    }

    static clearCache(): void {
        this.bankCache.clear();
    }
}
