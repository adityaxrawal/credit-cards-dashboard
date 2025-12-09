/**
 * Deterministic Prompt Factory for ML Email Classification
 * 
 * Generates consistent prompts with strict JSON schema enforcement
 * and representative examples from Indian bank transaction emails.
 */

export class PromptFactory {
    /**
     * Generate ML classification prompt with strict JSON-only output
     */
    static generateClassificationPrompt(emailText: string): string {
        return `You are an expert email classifier for Indian credit card transaction emails.

TASK: Classify the following email and extract merchant information using ONLY the provided JSON schema.

OUTPUT FORMAT (STRICT):
You MUST respond with ONLY valid JSON. No explanations. No commentary. No text outside JSON.

SCHEMA:
{
  "isTransaction": boolean,     // true ONLY for actual credit card transactions (purchase/refund)
  "category": string,           // one of: "transaction_success", "refund", "statement", "otp", "non_transaction"
  "merchant": string | null,    // merchant name if isTransaction=true, otherwise null
  "amount": number | null,      // transaction amount if isTransaction=true
  "currency": string | null,    // "INR", "USD", etc.
  "transactionDate": string | null, // ISO 8601 string (YYYY-MM-DDTHH:mm:ss) or null
  "cardLast4": string | null,   // "1234" or null
  "confidence": number          // 0.0 to 1.0 (1.0 = certain)
}

RULES:
1. isTransaction = true ONLY for actual credit card purchases or refunds
2. merchant MUST be null if isTransaction = false
3. Extract clean merchant names (remove "at", "from", timestamps, amounts, city names)
4. Parse amounts as numbers (remove commas, currency symbols)
5. Parse dates to ISO 8601 format if possible, otherwise null
6. If uncertain, respond with: {"isTransaction":false,"category":"non_transaction","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.0}

EXAMPLES:

Input: "HDFC Bank Credit Card alert: Rs.500 spent at SWIGGY on card ending 1234 on 05-Dec-24 at 19:30. Avl limit: Rs.45000"
Output: {"isTransaction":true,"category":"transaction_success","merchant":"SWIGGY","amount":500,"currency":"INR","transactionDate":"2024-12-05T19:30:00","cardLast4":"1234","confidence":0.99}

Input: "Your SBI Card XX1234 has been used for a transaction of INR 2,450.00 at AMAZON PAY on 09-Dec-2024 20:15:32. Available Credit Limit: INR 47,550.00"
Output: {"isTransaction":true,"category":"transaction_success","merchant":"AMAZON PAY","amount":2450.00,"currency":"INR","transactionDate":"2024-12-09T20:15:32","cardLast4":"1234","confidence":0.99}

Input: "ICICI Bank: Refund of Rs.1200 to your Credit Card ending 5678 from FLIPKART processed successfully on 08-Dec-24."
Output: {"isTransaction":true,"category":"refund","merchant":"FLIPKART","amount":1200,"currency":"INR","transactionDate":"2024-12-08T00:00:00","cardLast4":"5678","confidence":0.95}

Input: "Dear Customer, your Axis Bank Credit Card statement for Nov 2024 is ready. Download now from netbanking."
Output: {"isTransaction":false,"category":"statement","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.95}

Input: "OTP for HDFC Bank Credit Card transaction: 456789. Valid for 10 minutes. Do not share."
Output: {"isTransaction":false,"category":"otp","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.99}

Input: "Kotak Mahindra Bank: Your credit card bill of Rs.15,000 is due on 15-Dec-2024. Pay now to avoid late charges."
Output: {"isTransaction":false,"category":"non_transaction","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.9}

Input: "Yes Bank: Your Credit Card XX7890 was used for international transaction of USD 50.00 (INR 4,150) at NETFLIX on 07-Dec-24."
Output: {"isTransaction":true,"category":"transaction_success","merchant":"NETFLIX","amount":50.00,"currency":"USD","transactionDate":"2024-12-07T00:00:00","cardLast4":"7890","confidence":0.95}

Input: "Amex: You've earned 500 Membership Rewards points. Total points balance: 12,450. Redeem now!"
Output: {"isTransaction":false,"category":"non_transaction","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.98}

NOW CLASSIFY THIS EMAIL:

${emailText}

Remember: Output ONLY valid JSON matching the exact schema. No additional text.`;
    }

    /**
     * Generate Batch Classification Prompt
     * Packs multiple emails into one request for higher throughput
     */
    static generateBatchClassificationPrompt(emails: string[]): string {
        const emailSection = emails.map((text, index) =>
            `--- EMAIL ${index + 1} ---\n${text}\n------------------`
        ).join('\n\n');

        return `You are an expert email classifier for Indian credit card transaction emails.

TASK: Classify the following ${emails.length} emails and extract merchant information (including amount, currency, date) using the schema below.

OUTPUT FORMAT (STRICT):
You MUST respond with a JSON Array of objects. No explanations. No commentary.

SCHEMA Array Item:
{
  "emailIndex": number,         // 1-based index matching the input order
  "isTransaction": boolean,     // true ONLY for actual credit card transactions
  "category": string,           // "transaction_success", "refund", "statement", "otp", "non_transaction"
  "merchant": string | null,    // merchant name if isTransaction=true
  "amount": number | null,
  "currency": string | null,
  "transactionDate": string | null,
  "cardLast4": string | null,
  "confidence": number
}

INPUT EMAILS:

${emailSection}

REMEMBER: Return ONLY a JSON Array with ${emails.length} items. Start your response with \`[\`.`;
    }

    /**
     * Generate a simpler prompt for testing/debugging
     */
    static generateTestPrompt(emailText: string): string {
        return `Classify this credit card email. Respond with ONLY JSON:
{"isTransaction": boolean, "category": string, "merchant": string|null, "amount": number|null, "confidence": number}

Email: ${emailText}`;
    }
}
