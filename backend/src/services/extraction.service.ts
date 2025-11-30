import * as cheerio from 'cheerio';
import * as cardsQueries from '../db/queries/cards.queries';
import { BankParsers, ParsedTransaction } from './extraction/BankParsers';
import { PdfParser } from './extraction/PdfParser';

export interface ExtractionInput {
  id: string;
  subject: string;
  from: string;
  bodyText: string;
  bodyHtml?: string;
  date: Date;
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

    // If bodyText is empty or weak, try HTML
    if ((!textToParse || textToParse.length < 50) && message.bodyHtml) {
      const $ = cheerio.load(message.bodyHtml);
      // Remove scripts and styles
      $('script').remove();
      $('style').remove();
      textToParse = $('body').text();
    }
    
    // Clean text
    textToParse = PdfParser.cleanText(textToParse);

    // 3. Try Parsing Body
    let parsed: ParsedTransaction | null = parser.parse(textToParse, message.subject, message.from);

    // 4. If failed, try PDF Attachments
    if (!parsed && message.attachments && message.attachments.length > 0 && fetchAttachment) {
      console.log(`[ExtractionService] Body parse failed, checking ${message.attachments.length} attachments...`);
      
      for (const att of message.attachments) {
        if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          const buffer = await fetchAttachment(message.id, att.id);
          if (buffer) {
            const pdfText = await PdfParser.extractText(buffer);
            const cleanPdfText = PdfParser.cleanText(pdfText);
            parsed = parser.parse(cleanPdfText, message.subject, message.from);
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

    // 5. Find or Create Card
    let card = await cardsQueries.findCardByBankAndLastFour(
      userId,
      parsed.bankName,
      parsed.lastFourDigits
    );

    if (!card) {
      console.log(`[ExtractionService] Auto-creating card: ${parsed.cardName || parsed.bankName} ${parsed.lastFourDigits}`);
      try {
        card = await cardsQueries.createCard({
          userId,
          cardName: parsed.cardName || `${parsed.bankName} ${parsed.lastFourDigits}`,
          bankName: parsed.bankName,
          lastFour: parsed.lastFourDigits,
          billDate: 1, // Default
          dueDate: 10, // Default
          creditLimit: 0,
        });
      } catch (err) {
        console.error(`[ExtractionService] Failed to create card:`, err);
      }
    }

    return {
      status: 'success',
      transaction: {
        amount: parsed.amount,
        transactionDate: parsed.transactionDate,
        merchant: parsed.merchant,
        bankName: parsed.bankName,
        lastFourDigits: parsed.lastFourDigits,
        category: parsed.category,
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
