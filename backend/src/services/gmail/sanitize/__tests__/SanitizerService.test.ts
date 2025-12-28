import { SanitizerService } from '../sanitizer';

describe('SanitizerService', () => {
    describe('cleanText', () => {
        test('preserves newlines', () => {
            const input = 'Line 1\nLine 2';
            expect(SanitizerService['cleanText'](input)).toContain('\n');
            // Assuming we can access private method or test via public interface if possible
            // If private, we might need to test `sanitize` method
        });

        test('preserves basic structure from HTML', () => {
            const html = '<div>Block 1</div><div>Block 2</div>';
            // Access private method for testing: processBody(bodyText, bodyHtml)
            // We pass '' as bodyText so it uses bodyHtml logic
            const cleanText = (SanitizerService as any).processBody('', html);
            // Expect some separation - checking implementation detail that newlines are added
            expect(cleanText).toMatch(/Block 1\s+Block 2/);
        });

        test('preserves table cells', () => {
            const html = '<table><tr><td>Cell1</td><td>Cell2</td></tr></table>';
            const cleanText = (SanitizerService as any).processBody('', html);
            expect(cleanText).toContain('Cell1 Cell2');
        });
    });
});
