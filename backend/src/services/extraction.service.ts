import * as cheerio from 'cheerio';
import * as cardsQueries from '../db/queries/cards.queries';
import { BankParsers, ParsedTransaction } from './extraction/BankParsers';
import { PdfParser } from './extraction/PdfParser';
import { GmailLinkGenerator } from '../utils/GmailLinkGenerator';
import { BankParserPatterns } from '../utils/RegexCache';

export interface ExtractionInput {
  id: string;
  subject: string;
  from: string;
  bodyText: string;
  bodyHtml?: string;
  date: Date;
  threadId?: string;
  attachments?: { id: string; filename: string; mimeType: string }[];
}

export type AttachmentFetcher = (messageId: string, attachmentId: string) => Promise<Buffer | null>;

interface ExtractionResult {
  status: 'success' | 'error' | 'unknown_format';
  transaction?: {
    amount: number;
    transactionDate: Date;
    merchant: string;
    bankName: string;
    lastFourDigits: string;
    category: string;
    exactTimestamp?: Date;
    transactionType?: string;
    currencyCode?: string;
    originalAmount?: number;
    referenceNumber?: string;
    emailSubject?: string;
    gmailMessageId?: string;
    gmailThreadId?: string;
    gmailLink?: string;
    gmailThreadLink?: string;
  };
  error?: string;
}

/**
 * Extract transaction from email
 */
export async function extractTransactionFromEmail(
  userId: string,
  message: ExtractionInput,
  fetchAttachment?: AttachmentFetcher
): Promise<ExtractionResult> {
  try {
    // 1. Identify Bank Parser
    const parser = BankParsers.find(p => 
      p.identifiers.some(id => 
        message.from.toLowerCase().includes(id) || 
        message.subject.toLowerCase().includes(id)
      )
    );

    if (!parser) {
      console.log(`[ExtractionService] No parser found for: ${message.subject} from ${message.from}`);
      return { status: 'unknown_format', error: 'No matching bank parser found' };
    }

    // 2. Prepare Text Content
    let textToParse = message.bodyText;

    // Optimized HTML processing: Use fast regex for simple cases
    if ((!textToParse || textToParse.length < 50) && message.bodyHtml) {
      const html = message.bodyHtml;
      
      // Check if HTML contains scripts or styles (indicates complex HTML)
      const hasComplexHtml = /<script|<style/i.test(html);
      
      if (hasComplexHtml) {
        // Use Cheerio for complex HTML
        const $ = cheerio.load(html);
        $('script').remove();
        $('style').remove();
        textToParse = $('body').text();
      } else {
        // Use fast regex for simple HTML (10x faster)
        textToParse = html.replace(BankParserPatterns.HTML_TAGS, ' ')
                          .replace(BankParserPatterns.WHITESPACE, ' ')
                          .trim();
      }
    }
    
    // Clean text
    textToParse = PdfParser.cleanText(textToParse);

    // 3. Try Parsing Body
    let parsed: ParsedTransaction | null = parser.parse(textToParse, message.subject, message.from, message.date);

    // 4. If failed, try PDF Attachments
    if (!parsed && message.attachments && message.attachments.length > 0 && fetchAttachment) {
      console.log(`[ExtractionService] Body parse failed, checking ${message.attachments.length} attachments...`);
      
      for (const att of message.attachments) {
        if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          const buffer = await fetchAttachment(message.id, att.id);
          if (buffer) {
            const pdfText = await PdfParser.extractText(buffer);
            const cleanPdfText = PdfParser.cleanText(pdfText);
            parsed = parser.parse(cleanPdfText, message.subject, message.from, message.date);
            if (parsed) {
              console.log(`[ExtractionService] Successfully parsed PDF attachment: ${att.filename}`);
              break;
            }
          }
        }
      }
    }

    if (!parsed) {
      return { status: 'error', error: 'Failed to parse email content and attachments' };
    }

    // 5. Return transaction data without card lookup/creation
    // Card lookup and creation is now handled by historicalScanner with caching for better performance
    return {
      status: 'success',
      transaction: {
        amount: parsed.amount,
        transactionDate: parsed.transactionDate,
        merchant: parsed.merchant,
        bankName: parsed.bankName,
        lastFourDigits: parsed.lastFourDigits,
        category: parsed.category,
        exactTimestamp: parsed.exactTimestamp,
        transactionType: parsed.transactionType,
        currencyCode: parsed.currencyCode,
        originalAmount: parsed.originalAmount,
        referenceNumber: parsed.referenceNumber,
        emailSubject: message.subject,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        gmailLink: GmailLinkGenerator.generateLink(message.id),
        gmailThreadLink: message.threadId ? GmailLinkGenerator.generateThreadLink(message.threadId) : undefined,
      },
    };

  } catch (error) {
    console.error('[ExtractionService] Error extracting transaction:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
