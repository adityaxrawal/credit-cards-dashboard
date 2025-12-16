
const pdfParse = require('pdf-parse');
console.log('Type of pdfParse:', typeof pdfParse);
console.log('Is function?', typeof pdfParse === 'function');
console.log('Keys:', Object.keys(pdfParse));

// Mock buffer
const buffer = Buffer.from('dummy pdf content');

try {
  if (typeof pdfParse === 'function') {
    pdfParse(buffer).then(() => console.log('Successfully called function')).catch(e => console.log('Caught expected error (invalid pdf)'));
  } else if (typeof pdfParse.default === 'function') {
    console.log('Using .default');
    pdfParse.default(buffer).then(() => console.log('Successfully called default')).catch(e => console.log('Caught expected error'));
  } else {
    console.log('Cannot find function');
  }
} catch (e) {
  console.log('Error calling:', e);
}
