/**
 * Deterministic Prompt Factory for ML Email Classification
 * 
 * Generates consistent prompts with strict JSON schema enforcement
 * and representative examples from Indian bank transaction emails.
 */

export class PromptFactory {
    /**
     * Generate ML classification prompt optimized for DeepSeek-R1 reasoning model
     * 
     * DeepSeek-R1 uses a think-then-answer pattern with explicit <think> tags.
     * This prompt instructs the model to reason step-by-step, then output clean JSON.
     */
    static generateClassificationPrompt(emailText: string): string {
        return `You are an expert email classifier specializing in **Indian credit card transactions**.

Your job is to analyze a raw email (subject + body) and decide:
- Is this email describing a specific credit card transaction?
- If yes, extract transaction details.
- If no, classify the type (e.g., statement, OTP, generic marketing).

IMPORTANT BEHAVIOR:
- First, think through the problem in <think></think> tags.
- Then, AFTER the thinking, output ONLY a single JSON object.
- Do not include any text after the JSON object.
- Do not wrap the JSON in markdown or code fences.

REASONING FORMAT (MANDATORY):
<think>
- Reason step by step.
- Extract relevant clues (amount, merchant, card, date, etc.).
- Explain why the email is or is not a transaction.
- Explain how confident you are (0–1).
</think>

OUTPUT JSON SCHEMA (MANDATORY FIELDS):
- "isTransaction": boolean
- "category": one of:
    - "transaction_success"
    - "refund"
    - "statement"
    - "otp"
    - "non_transaction"
- "merchant": string | null
- "amount": number | null   // numeric only, no currency symbol
- "currency": string | null // e.g., "INR", "USD"
- "transactionDate": string | null // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" if you can infer date
- "cardLast4": string | null       // last 4 digits if present
- "confidence": number             // 0.0 to 1.0

MERCHANT EXTRACTION RULES:
- Extract ONLY the business name: "SWIGGY" not "SWIGGY INDIA PVT LTD BANGALORE"
- REMOVE: cities, "PVT LTD", "PRIVATE LIMITED", "INDIA", timestamps, card numbers
- REMOVE: prepositions like "at", "from", "on"
- Examples: "AMAZON PAY" not "AMAZON PAY INDIA", "NETFLIX" not "NETFLIX.COM"

EXAMPLE 1 – CLEAR TRANSACTION
Input email:
"HDFC Bank Alert: Debit of Rs.500 at SWIGGY on Card ending 1234 on 10-12-2025."

<think>
- "Debit of Rs.500" → clear amount and debit.
- "at SWIGGY" → merchant name.
- "Card ending 1234" → card info.
- Sent by HDFC Bank, typical transaction alert.
This is a successful card transaction email with high confidence.
</think>

{"isTransaction": true,
 "category": "transaction_success",
 "merchant": "SWIGGY",
 "amount": 500,
 "currency": "INR",
 "transactionDate": "2025-12-10T00:00:00",
 "cardLast4": "1234",
 "confidence": 0.96}

EXAMPLE 2 – NON-TRANSACTION (MARKETING)
Input email:
"Earn 5X rewards on all weekend spends with your HDFC credit card. Offer valid till 31st Dec."

<think>
- No specific amount or merchant.
- No specific transaction described.
- Promotional content about future spending.
This is marketing, not a specific transaction.
</think>

{"isTransaction": false,
 "category": "non_transaction",
 "merchant": null,
 "amount": null,
 "currency": null,
 "transactionDate": null,
 "cardLast4": null,
 "confidence": 0.98}

EXAMPLE 3 – STATEMENT NOTIFICATION
Input email:
"Your November 2025 credit card statement is ready. Total due: Rs. 12,450. Due date: 12-12-2025."

<think>
- Refers to the monthly statement.
- No specific transaction details (merchant, place, individual amount).
- This is a statement summary email.
</think>

{"isTransaction": false,
 "category": "statement",
 "merchant": null,
 "amount": null,
 "currency": null,
 "transactionDate": null,
 "cardLast4": null,
 "confidence": 0.9}

EXAMPLE 4 – OTP
Input email:
"Your OTP for credit card transaction is 456789. Valid for 10 minutes. Do not share."

<think>
- This is an OTP for authentication.
- No transaction details present yet.
- Not a transaction notification, just security code.
</think>

{"isTransaction": false,
 "category": "otp",
 "merchant": null,
 "amount": null,
 "currency": null,
 "transactionDate": null,
 "cardLast4": null,
 "confidence": 0.99}

EXAMPLE 5 – REFUND
Input email:
"ICICI Bank: Refund of Rs.1200 to your Credit Card ending 5678 from FLIPKART processed on 08-Dec-24."

<think>
- "Refund of Rs.1200" → clear refund transaction.
- "from FLIPKART" → merchant.
- This is a refund, which is also a transaction type.
</think>

{"isTransaction": true,
 "category": "refund",
 "merchant": "FLIPKART",
 "amount": 1200,
 "currency": "INR",
 "transactionDate": "2024-12-08T00:00:00",
 "cardLast4": "5678",
 "confidence": 0.95}

NOW ANALYZE THE FOLLOWING EMAIL.

Below is the raw email content (subject + body). Use only this information.

EMAIL:
${emailText}

FIRST, write your reasoning inside <think></think> tags.
THEN, on a new line after </think>, output ONLY the JSON object described above.`;
    }

    /**
     * Generate Batch Classification Prompt
     * Packs multiple emails into one request for higher throughput
     * Includes few-shot examples for better accuracy
     */
    static generateBatchClassificationPrompt(emails: string[]): string {
        const emailSection = emails.map((text, index) =>
            `--- EMAIL ${index + 1} ---\n${text}\n------------------`
        ).join('\n\n');

        return `You are an expert email classifier for Indian credit card transaction emails.

TASK: Classify the following ${emails.length} emails and extract transaction details.

OUTPUT FORMAT (STRICT):
Respond with a JSON Array ONLY. No explanations. No markdown code blocks. Start your response with [.

SCHEMA for each item:
{"emailIndex":number,"isTransaction":boolean,"category":"...","merchant":"..."|null,"amount":number|null,"currency":"..."|null,"transactionDate":"..."|null,"cardLast4":"..."|null,"confidence":0.0-1.0}

EXAMPLES:

INPUT: "HDFC Bank: Rs.500 at SWIGGY on XX1234 09-Dec-24"
OUTPUT: [{"emailIndex":1,"isTransaction":true,"category":"transaction_success","merchant":"SWIGGY","amount":500,"currency":"INR","transactionDate":"2024-12-09T00:00:00","cardLast4":"1234","confidence":0.95}]

INPUT: "Your OTP is 456789. Valid 10 min."
OUTPUT: [{"emailIndex":1,"isTransaction":false,"category":"otp","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.98}]

INPUT: "SBI Card statement for Nov ready. Total due Rs.15000."
OUTPUT: [{"emailIndex":1,"isTransaction":false,"category":"statement","merchant":null,"amount":null,"currency":null,"transactionDate":null,"cardLast4":null,"confidence":0.92}]

INPUT EMAILS:

${emailSection}

RESPOND WITH JSON ARRAY ONLY (start with [):`;
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
