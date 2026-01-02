import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';

describe('InstrumentAutoService', () => {
    describe('extractAccountLast4', () => {
        test('extracts standard "ending 1234" format', () => {
            expect(InstrumentAutoService.extractAccountLast4('card ending 1234')).toBe('1234');
            expect(InstrumentAutoService.extractAccountLast4('account ending with 4321')).toBe('4321');
        });

        test('extracts masked formats', () => {
            expect(InstrumentAutoService.extractAccountLast4('Card: x-1234')).toBe('1234');
            expect(InstrumentAutoService.extractAccountLast4('A/c **1234')).toBe('1234');
            expect(InstrumentAutoService.extractAccountLast4('XX1234')).toBe('1234');
        });

        test('extracts "ending in" format', () => {
            expect(InstrumentAutoService.extractAccountLast4('card ending in 9876')).toBe('9876');
        });
    });
});
