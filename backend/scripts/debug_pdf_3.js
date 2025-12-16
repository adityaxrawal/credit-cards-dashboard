
const pdfLib = require('pdf-parse');
const { PDFParse } = pdfLib;

try {
    const buffer = Buffer.from('dummy pdf content');
    const instance = new PDFParse(buffer);
    console.log('Instance created');
    console.log('Instance keys:', Object.keys(instance));
    console.log('Prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
    
    // Check for obvious methods
    if (instance.extractText) console.log('Has extractText');
    if (instance.text) console.log('Has text property');
    
} catch (e) {
    console.log('Error creating instance:', e.message);
}
