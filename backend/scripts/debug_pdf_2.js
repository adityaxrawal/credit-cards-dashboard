
const pdfLib = require('pdf-parse');
console.log('Keys:', Object.keys(pdfLib));

if (pdfLib.PDFParse) {
  console.log('Found PDFParse export');
  console.log('Type:', typeof pdfLib.PDFParse);
  
  // Try invoking it if it's a function
  if (typeof pdfLib.PDFParse === 'function') {
      const buffer = Buffer.from('dummy pdf content');
      try {
        const promise = pdfLib.PDFParse(buffer);
        console.log('Invoked PDFParse, returned:', promise);
        if (promise && promise.catch) {
            promise.catch(e => console.log('Promise failed as expected for dummy buffer:', e.message));
        }
      } catch(e) {
          console.log('Sync error invoking PDFParse:', e.message);
      }
  }
} else {
    console.log('PDFParse export NOT found');
}
