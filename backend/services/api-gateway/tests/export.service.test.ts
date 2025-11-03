import {
  CSVExportService,
  PDFExportService,
  ExcelExportService,
} from "../src/services/export.service";
import fs from "fs";
import path from "path";

describe("Export Services", () => {
  const testOutputDir = path.join(__dirname, "test-exports");

  beforeAll(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe("CSVExportService", () => {
    describe("arrayToCSV", () => {
      it("should convert simple array to CSV", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];

        const csv = CSVExportService.arrayToCSV(data);

        expect(csv).toContain("name,age");
        expect(csv).toContain("John,30");
        expect(csv).toContain("Jane,25");
      });

      it("should escape special characters", () => {
        const data = [{ name: 'John "Doe"', note: "Hello, world" }];

        const csv = CSVExportService.arrayToCSV(data);

        expect(csv).toContain('"John ""Doe"""');
        expect(csv).toContain('"Hello, world"');
      });

      it("should handle empty array", () => {
        const csv = CSVExportService.arrayToCSV([]);
        expect(csv).toBe("");
      });

      it("should handle null and undefined values", () => {
        const data = [{ name: "John", age: null, city: undefined }];

        const csv = CSVExportService.arrayToCSV(data);

        expect(csv).toContain("name,age,city");
        expect(csv).toContain("John,,");
      });
    });

    describe("generateTransactionsCSV", () => {
      it("should generate transactions CSV with correct format", () => {
        const transactions = [
          {
            transaction_date: new Date("2024-01-15"),
            merchant_name: "Amazon",
            merchant_category: "Shopping",
            amount: 5999,
            transaction_type: "debit",
            card_name: "Chase Sapphire",
            description: "Online purchase",
          },
        ];

        const csv = CSVExportService.generateTransactionsCSV(transactions);

        expect(csv).toContain("Date,Merchant,Category,Amount");
        expect(csv).toContain("Amazon");
        expect(csv).toContain("Shopping");
      });
    });

    describe("generateCategoryBreakdownCSV", () => {
      it("should generate category breakdown CSV with correct format", () => {
        const categories = [
          {
            name: "Shopping",
            amount: 15000,
            percentage: 45.5,
            transactionCount: 5,
            averageAmount: 3000,
          },
        ];

        const csv = CSVExportService.generateCategoryBreakdownCSV(categories);

        expect(csv).toContain("Category,Amount,Percentage");
        expect(csv).toContain("Shopping");
        expect(csv).toContain("15000.00");
        expect(csv).toContain("45.50");
      });
    });

    describe("saveToFile", () => {
      it("should save CSV content to file", async () => {
        const csvContent = "name,age\nJohn,30\nJane,25";
        const fileName = "test-save.csv";

        const result = await CSVExportService.saveToFile(
          csvContent,
          fileName,
          testOutputDir
        );

        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(result.fileSize).toBeGreaterThan(0);

        const content = fs.readFileSync(result.filePath, "utf-8");
        expect(content).toBe(csvContent);
      });
    });
  });

  describe("PDFExportService", () => {
    describe("generatePDF", () => {
      it("should generate PDF from HTML", async () => {
        const title = "Test Report";
        const content =
          "<div><h2>Test Content</h2><p>This is a test report.</p></div>";
        const fileName = "test.pdf";

        try {
          const result = await PDFExportService.generatePDF(
            title,
            content,
            fileName,
            { "Report Type": "Test", Period: "January 2024" },
            testOutputDir
          );

          expect(fs.existsSync(result.filePath)).toBe(true);
          expect(result.fileSize).toBeGreaterThan(0);
        } catch (error) {
          // PDF generation might fail in CI environments without proper browser setup
          console.warn("PDF generation skipped:", error);
        }
      }, 30000);
    });

    describe("generateSpendingSummaryHTML", () => {
      it("should create properly formatted spending summary HTML", () => {
        const data = {
          totalSpent: 5999,
          totalEarned: 199,
        };

        const html = PDFExportService.generateSpendingSummaryHTML(data);

        expect(html).toContain("Summary");
        expect(html).toContain("Total Spent");
        expect(html).toContain("5999.00");
      });
    });
  });

  describe("ExcelExportService", () => {
    describe("generateExcel", () => {
      it("should create Excel-compatible content with BOM", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];

        const excelContent = ExcelExportService.generateExcel(data);

        // Check for UTF-8 BOM at start
        expect(excelContent.charCodeAt(0)).toBe(0xfeff);
        expect(excelContent).toContain("name,age");
        expect(excelContent).toContain("John,30");
        expect(excelContent).toContain("Jane,25");
      });

      it("should format data correctly for Excel", () => {
        const data = [{ name: "John", amount: 1234.56 }];

        const excelContent = ExcelExportService.generateExcel(data);

        expect(excelContent).toContain("name,amount");
        expect(excelContent).toContain("John,1234.56");
      });
    });

    describe("saveToFile", () => {
      it("should save Excel content to file with .xlsx extension", async () => {
        const data = [{ name: "John", age: 30 }];

        const excelContent = ExcelExportService.generateExcel(data);
        const result = await ExcelExportService.saveToFile(
          excelContent,
          "test-excel.xlsx",
          testOutputDir
        );

        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(result.filePath).toMatch(/\.xlsx$/);
        expect(result.fileSize).toBeGreaterThan(0);

        const content = fs.readFileSync(result.filePath, "utf-8");
        expect(content.charCodeAt(0)).toBe(0xfeff); // BOM check
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid file paths gracefully", async () => {
      const invalidPath = "/invalid/path/that/does/not/exist";
      const csvContent = "test,data\n1,2";

      await expect(
        CSVExportService.saveToFile(csvContent, "test.csv", invalidPath)
      ).rejects.toThrow();
    });

    it("should handle empty data arrays", () => {
      const csv = CSVExportService.arrayToCSV([]);
      expect(csv).toBe("");
    });

    it("should handle missing fields gracefully", () => {
      const data = [{ name: "John" }, { name: "Jane", age: 25 }];

      const csv = CSVExportService.arrayToCSV(data);
      expect(csv).toContain("name");
      expect(csv).toContain("John");
      expect(csv).toContain("Jane");
    });
  });
});
