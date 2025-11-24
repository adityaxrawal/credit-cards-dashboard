import pool from '../db';

export const extractTransactions = async (emailContent: string, userId: string) => {
  // Regex patterns for Indian banks
  const patterns = [
    /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)/i, // Amount
    /at\s+([A-Za-z0-9\s]+)\s+on/i, // Merchant
    /(?:ending\s+in|ending\s+with)\s+(\d{4})/i // Card last 4
  ];

  // Mock extraction logic
  // In real app, we would parse email body, match regex, and insert into DB
  console.log('Extracting transactions from email...');
};
