
const { PdfParser } = require('../src/services/extraction/pdfParser');

// Mock Buffer
const buffer = Buffer.from('dummy pdf content');

(async () => {
    try {
        console.log('Testing PdfParser.extractText...');
        const text = await PdfParser.extractText(buffer);
        console.log('Result:', text);
        console.log('Success: No crash!');
    } catch (e) {
        console.error('Crash:', e);
    }
})();
