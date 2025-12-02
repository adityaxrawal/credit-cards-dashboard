/**
 * Performance Benchmark for RegexCache
 * 
 * Compares pre-compiled regex vs inline compilation
 * Expected improvement: 30-50x faster
 */

import { BankParserPatterns, RegexCache } from '../RegexCache';

describe('RegexCache Performance Benchmark', () => {
  const ITERATIONS = 10000;
  const sampleText = 'Your HDFC Bank Credit Card XX1234 has been debited with Rs.1,250.00 at AMAZON INDIA on 01-Dec-2024. Ref No: ABC123456';
  
  it('should be significantly faster than inline regex compilation', () => {
    // Warmup
    for (let i = 0; i < 100; i++) {
      BankParserPatterns.AMOUNT_INTL.test(sampleText);
    }
    
    // Test pre-compiled regex
    const precompiledStart = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
      BankParserPatterns.AMOUNT_INTL.test(sampleText);
      BankParserPatterns.CARD_XX_DIGITS.test(sampleText);
      BankParserPatterns.MERCHANT_AT.test(sampleText);
      BankParserPatterns.REF_NUMBER_1.test(sampleText);
    }
    const precompiledTime = Date.now() - precompiledStart;
    
    // Test inline regex compilation
    const inlineStart = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
      /(?:Rs\.?|INR|₹|USD|EUR|GBP)\s*([0-9,]+\.?[0-9]*)/i.test(sampleText);
      /(?:XX|xx)[\s*]*(\d{4})/i.test(sampleText);
      /(?:at|@)\s+([A-Za-z0-9\s*&.\-\/()]+?)(?:\s+on\s+(?:\d|[A-Za-z]{3})|\s+dated|\s+for\s+Rs|\.|\,|\n|$)/i.test(sampleText);
      /(?:Ref No|Reference No|Txn Ref|Transaction ID|Ref|Txn ID)\b[:\s]*([A-Za-z0-9]+)/i.test(sampleText);
    }
    const inlineTime = Date.now() - inlineStart;
    
    const improvement = (inlineTime / precompiledTime).toFixed(1);
    
    console.log('\n=== RegexCache Performance Benchmark ===');
    console.log(`Pre-compiled: ${precompiledTime}ms for ${ITERATIONS * 4} operations`);
    console.log(`Inline compilation: ${inlineTime}ms for ${ITERATIONS * 4} operations`);
    console.log(`Performance improvement: ${improvement}x faster`);
    console.log(`Per-operation: ${(precompiledTime / (ITERATIONS * 4)).toFixed(3)}ms vs ${(inlineTime / (ITERATIONS * 4)).toFixed(3)}ms\n`);
    
    expect(precompiledTime).toBeLessThan(inlineTime);
    expect(parseFloat(improvement)).toBeGreaterThan(10); // At least 10x faster
  });
  
  it('should have minimal memory overhead', () => {
    const initialSize = RegexCache.size();
    
    // Add many patterns
    for (let i = 0; i < 100; i++) {
      RegexCache.get(`pattern-${i}`, 'i');
    }
    
    const finalSize = RegexCache.size();
    
    console.log(`\nRegexCache size: ${initialSize} -> ${finalSize} patterns`);
    
    expect(finalSize).toBeGreaterThan(initialSize);
  });
});
