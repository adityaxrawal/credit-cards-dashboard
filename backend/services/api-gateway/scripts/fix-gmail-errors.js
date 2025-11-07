#!/usr/bin/env node
/**
 * Fix Gmail-related TypeScript errors
 */

const fs = require("fs");
const path = require("path");

const apiGatewayDir = path.join(__dirname, "..");

console.log("🔧 Fixing Gmail-related TypeScript errors...\n");

// Fix email-fetcher.ts
const emailFetcherPath = path.join(
  apiGatewayDir,
  "src/modules/gmail/email-fetcher.ts"
);
let emailFetcherContent = fs.readFileSync(emailFetcherPath, "utf8");

// Fix error.code type checking
emailFetcherContent = emailFetcherContent.replace(
  "    } catch (error: unknown) {\n      if (error.code === 404) {",
  "    } catch (error: unknown) {\n      if ((error as any)?.code === 404) {"
);

emailFetcherContent = emailFetcherContent.replace(
  "      logger.error(\"Failed to fetch email\", { error, messageId });",
  "      logger.error(\"Failed to fetch email\", { error: error instanceof Error ? error.message : String(error), messageId });"
);

emailFetcherContent = emailFetcherContent.replace(
  "      logger.error(\"Failed to list messages\", { error, query });",
  "      logger.error(\"Failed to list messages\", { error: error instanceof Error ? error.message : String(error), query });"
);

emailFetcherContent = emailFetcherContent.replace(
  "      if (error.code === 404) {",
  "      if ((error as any)?.code === 404) {"
);

emailFetcherContent = emailFetcherContent.replace(
  "      logger.error(\"Failed to get history\", { error, historyId });",
  "      logger.error(\"Failed to get history\", { error: error instanceof Error ? error.message : String(error), historyId });"
);

fs.writeFileSync(emailFetcherPath, emailFetcherContent, "utf8");
console.log("✅ Fixed email-fetcher.ts");

// Fix transaction-extractor.ts
const extractorPath = path.join(
  apiGatewayDir,
  "src/modules/gmail/extractor/transaction-extractor.ts"
);
let extractorContent = fs.readFileSync(extractorPath, "utf8");

extractorContent = extractorContent.replace(
  "      logger.error(\"Extraction failed\", { error, emailId: email.id });",
  "      logger.error(\"Extraction failed\", { error: error instanceof Error ? error.message : String(error), emailId: email.id });"
);

// Fix type issues in extractFromMapping
extractorContent = extractorContent.replace(
  "    // Extract amount\n    if (mapping.amount !== undefined) {\n      const amountStr = typeof mapping.amount === \"number\" ? match[mapping.amount] : mapping.amount;\n      const amount = this.parseAmount(amountStr);",
  "    // Extract amount\n    if (mapping.amount !== undefined) {\n      const amountStr = typeof mapping.amount === \"number\" ? match[mapping.amount] : mapping.amount;\n      const amount = this.parseAmount(String(amountStr || ''));"
);

extractorContent = extractorContent.replace(
  "    // Extract transaction type\n    if (mapping.transactionType) {\n      extracted.transactionType = mapping.transactionType;",
  "    // Extract transaction type\n    if (mapping.transactionType) {\n      extracted.transactionType = mapping.transactionType as \"debit\" | \"credit\" | \"refund\";"
);

extractorContent = extractorContent.replace(
  "    // Extract merchant\n    if (mapping.merchant !== undefined) {\n      const merchantStr =\n        typeof mapping.merchant === \"number\" ? match[mapping.merchant] : mapping.merchant;\n      extracted.merchant = this.cleanMerchantName(merchantStr);",
  "    // Extract merchant\n    if (mapping.merchant !== undefined) {\n      const merchantStr =\n        typeof mapping.merchant === \"number\" ? match[mapping.merchant] : mapping.merchant;\n      extracted.merchant = this.cleanMerchantName(String(merchantStr || ''));"
);

extractorContent = extractorContent.replace(
  "    // Extract card last 4\n    if (mapping.cardLast4 !== undefined) {\n      const cardStr =\n        typeof mapping.cardLast4 === \"number\" ? match[mapping.cardLast4] : mapping.cardLast4;\n      extracted.cardLast4 = cardStr?.trim();",
  "    // Extract card last 4\n    if (mapping.cardLast4 !== undefined) {\n      const cardStr =\n        typeof mapping.cardLast4 === \"number\" ? match[mapping.cardLast4] : mapping.cardLast4;\n      extracted.cardLast4 = String(cardStr || '').trim();"
);

extractorContent = extractorContent.replace(
  "    // Extract balance\n    if (mapping.balance !== undefined) {\n      const balanceStr =\n        typeof mapping.balance === \"number\" ? match[mapping.balance] : mapping.balance;\n      const balance = this.parseAmount(balanceStr);",
  "    // Extract balance\n    if (mapping.balance !== undefined) {\n      const balanceStr =\n        typeof mapping.balance === \"number\" ? match[mapping.balance] : mapping.balance;\n      const balance = this.parseAmount(String(balanceStr || ''));"
);

extractorContent = extractorContent.replace(
  "    // Currency\n    extracted.currency = mapping.currency || \"INR\";",
  "    // Currency\n    extracted.currency = (mapping.currency as string) || \"INR\";"
);

fs.writeFileSync(extractorPath, extractorContent, "utf8");
console.log("✅ Fixed transaction-extractor.ts");

// Fix services.routes.ts
const servicesRoutesPath = path.join(apiGatewayDir, "src/routes/services.routes.ts");
let servicesRoutesContent = fs.readFileSync(servicesRoutesPath, "utf8");

// Replace all { error: ... } patterns
servicesRoutesContent = servicesRoutesContent.replace(
  /error: (\w+)/g,
  "errorDetails: $1 instanceof Error ? $1.message : String($1)"
);

fs.writeFileSync(servicesRoutesPath, servicesRoutesContent, "utf8");
console.log("✅ Fixed services.routes.ts");

console.log("\n✨ Gmail-related fixes completed!\n");
