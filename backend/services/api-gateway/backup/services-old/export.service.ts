import { format } from "date-fns";
import * as fs from "fs";
import * as path from "path";

/**
 * CSV Export Utility Service
 */
export class CSVExportService {
  /**
   * Convert data to CSV format
   */
  static arrayToCSV(
    data: Record<string, any>[],
    columns?: { key: string; label: string }[]
  ): string {
    if (!data || data.length === 0) {
      return "";
    }

    // If columns not provided, use all keys from first object
    const cols =
      columns || Object.keys(data[0]).map((key) => ({ key, label: key }));

    // Create header row
    const header = cols.map((col) => this.escapeCSVValue(col.label)).join(",");

    // Create data rows
    const rows = data.map((row) => {
      return cols
        .map((col) => {
          const value = row[col.key];
          return this.escapeCSVValue(this.formatValue(value));
        })
        .join(",");
    });

    return [header, ...rows].join("\n");
  }

  /**
   * Escape CSV values
   */
  private static escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Format value for CSV
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (value instanceof Date) {
      return format(value, "yyyy-MM-dd HH:mm:ss");
    }

    if (typeof value === "number") {
      return value.toFixed(2);
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Save CSV to file
   */
  static async saveToFile(
    csvContent: string,
    fileName: string,
    directory?: string
  ): Promise<{ filePath: string; fileSize: number }> {
    const dir = directory || path.join(process.cwd(), "temp", "exports");

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, csvContent, "utf-8");

    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileSize: stats.size,
    };
  }

  /**
   * Generate CSV for transactions
   */
  static generateTransactionsCSV(transactions: any[]): string {
    const columns = [
      { key: "transaction_date", label: "Date" },
      { key: "merchant_name", label: "Merchant" },
      { key: "merchant_category", label: "Category" },
      { key: "amount", label: "Amount (₹)" },
      { key: "transaction_type", label: "Type" },
      { key: "card_name", label: "Card" },
      { key: "description", label: "Description" },
    ];

    return this.arrayToCSV(transactions, columns);
  }

  /**
   * Generate CSV for category breakdown
   */
  static generateCategoryBreakdownCSV(categories: any[]): string {
    const columns = [
      { key: "name", label: "Category" },
      { key: "amount", label: "Amount (₹)" },
      { key: "percentage", label: "Percentage (%)" },
      { key: "transactionCount", label: "Transactions" },
      { key: "averageAmount", label: "Average (₹)" },
    ];

    return this.arrayToCSV(categories, columns);
  }

  /**
   * Generate CSV for card utilization
   */
  static generateCardUtilizationCSV(cards: any[]): string {
    const columns = [
      { key: "name", label: "Card Name" },
      { key: "type", label: "Type" },
      { key: "totalSpent", label: "Total Spent (₹)" },
      { key: "transactionCount", label: "Transactions" },
      { key: "utilizationRate", label: "Utilization (%)" },
      { key: "creditLimit", label: "Credit Limit (₹)" },
      { key: "availableCredit", label: "Available (₹)" },
    ];

    return this.arrayToCSV(cards, columns);
  }
}

/**
 * PDF Export Utility Service (using Puppeteer)
 */
export class PDFExportService {
  /**
   * Generate HTML template for PDF
   */
  private static generateHTMLTemplate(
    title: string,
    content: string,
    metadata?: Record<string, any>
  ): string {
    const currentDate = format(new Date(), "MMMM dd, yyyy");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      color: #333;
      line-height: 1.6;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      color: #1e40af;
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header .date {
      color: #6b7280;
      font-size: 14px;
    }
    
    .metadata {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    
    .metadata-item {
      display: inline-block;
      margin-right: 20px;
      margin-bottom: 10px;
    }
    
    .metadata-item strong {
      color: #374151;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    th {
      background: #2563eb;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:nth-child(even) {
      background: #f9fafb;
    }
    
    .summary-card {
      display: inline-block;
      background: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin-right: 15px;
      margin-bottom: 15px;
      min-width: 200px;
    }
    
    .summary-card h3 {
      color: #1e40af;
      font-size: 14px;
      margin-bottom: 10px;
    }
    
    .summary-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      color: #1e40af;
      font-size: 20px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #dbeafe;
    }
    
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="date">Generated on ${currentDate}</div>
  </div>
  
  ${
    metadata
      ? `
    <div class="metadata">
      ${Object.entries(metadata)
        .map(
          ([key, value]) =>
            `<div class="metadata-item"><strong>${key}:</strong> ${value}</div>`
        )
        .join("")}
    </div>
  `
      : ""
  }
  
  ${content}
  
  <div class="footer">
    <p>Credit Card Dashboard - Financial Report</p>
    <p>This report is confidential and intended for the recipient only.</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate PDF from HTML (requires puppeteer)
   */
  static async generatePDF(
    title: string,
    content: string,
    fileName: string,
    metadata?: Record<string, any>,
    directory?: string
  ): Promise<{ filePath: string; fileSize: number }> {
    const puppeteer = require("puppeteer");

    const dir = directory || path.join(process.cwd(), "temp", "exports");

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);
    const html = this.generateHTMLTemplate(title, content, metadata);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    await page.pdf({
      path: filePath,
      format: "A4",
      margin: {
        top: "20mm",
        right: "15mm",
        bottom: "20mm",
        left: "15mm",
      },
      printBackground: true,
    });

    await browser.close();

    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileSize: stats.size,
    };
  }

  /**
   * Generate spending summary HTML content
   */
  static generateSpendingSummaryHTML(data: any): string {
    return `
      <div class="section">
        <h2 class="section-title">Summary</h2>
        <div class="summary-card">
          <h3>Total Spent</h3>
          <div class="value">₹${data.totalSpent.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <h3>Total Earned</h3>
          <div class="value">₹${data.totalEarned.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <h3>Net Cashflow</h3>
          <div class="value">₹${data.netCashflow.toFixed(2)}</div>
        </div>
        <div class="summary-card">
          <h3>Transactions</h3>
          <div class="value">${data.transactionCount}</div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">Top Categories</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Transactions</th>
            </tr>
          </thead>
          <tbody>
            ${data.topCategories
              .map(
                (cat: any) => `
              <tr>
                <td>${cat.category}</td>
                <td>₹${cat.amount.toFixed(2)}</td>
                <td>${cat.count}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2 class="section-title">Top Merchants</h2>
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Transactions</th>
            </tr>
          </thead>
          <tbody>
            ${data.topMerchants
              .map(
                (merchant: any) => `
              <tr>
                <td>${merchant.merchant}</td>
                <td>₹${merchant.amount.toFixed(2)}</td>
                <td>${merchant.count}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate transactions list HTML content
   */
  static generateTransactionsListHTML(transactions: any[]): string {
    return `
      <div class="section">
        <h2 class="section-title">Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Card</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (tx: any) => `
              <tr>
                <td>${format(
                  new Date(tx.transaction_date),
                  "MMM dd, yyyy"
                )}</td>
                <td>${tx.merchant_name || "N/A"}</td>
                <td>${tx.merchant_category || "N/A"}</td>
                <td>₹${tx.amount.toFixed(2)}</td>
                <td>${tx.card_name || "N/A"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }
}

/**
 * Excel Export Utility Service (simplified using CSV approach)
 * For more advanced Excel features, consider using 'exceljs' library
 */
export class ExcelExportService {
  /**
   * Generate Excel-compatible CSV (with BOM for proper encoding)
   */
  static generateExcel(
    data: Record<string, any>[],
    sheetName: string = "Sheet1"
  ): string {
    // Add BOM for proper Excel UTF-8 encoding
    const BOM = "\uFEFF";
    const csv = CSVExportService.arrayToCSV(data);
    return BOM + csv;
  }

  /**
   * Save Excel to file
   */
  static async saveToFile(
    content: string,
    fileName: string,
    directory?: string
  ): Promise<{ filePath: string; fileSize: number }> {
    const dir = directory || path.join(process.cwd(), "temp", "exports");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Ensure .xlsx extension
    if (!fileName.endsWith(".xlsx")) {
      fileName = fileName.replace(/\.[^.]+$/, "") + ".xlsx";
    }

    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, content, "utf-8");

    const stats = fs.statSync(filePath);

    return {
      filePath,
      fileSize: stats.size,
    };
  }
}
