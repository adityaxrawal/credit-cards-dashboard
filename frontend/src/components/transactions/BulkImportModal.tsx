import React, { useState, useRef } from "react";
import { Modal, Button } from "@/components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionApi, TransactionFormData } from "@/lib/api/transactions";
import { useToast } from "@/components/ui/Toast";
import { Upload, AlertCircle, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: { id: string; card_name: string; last_four_digits: string }[];
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  merchant: string;
  category: string;
}

export function BulkImportModal({ isOpen, onClose, cards }: BulkImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [progress, setProgress] = useState(0);

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setParsedData([]);
    setSelectedCardId("");
    setProgress(0);

  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        errorToast("Please upload a valid CSV file");
        return;
      }
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = text.split("\n").map(row => row.trim()).filter(row => row.length > 0);
        if (rows.length < 2) {
          throw new Error("CSV file is empty or has no data rows");
        }

        // Simple CSV parsing (assuming headers: Date, Description, Amount, Merchant, Category)
        // Adjust logic to be more flexible or map columns in a real app
        // Adjust logic to be more flexible or map columns in a real app
        const dataRows = rows.slice(1);

        const parsed: ParsedTransaction[] = dataRows.map((row) => {
          // Handle quotes if necessary, simplified split for now
          const cols = row.split(",").map(c => c.trim());
          
          // Basic mapping based on position if headers don't match exactly
          // Assuming: Date, Description, Amount, Merchant, Category
          const dateStr = cols[0];
          const desc = cols[1] || "";
          const amountStr = cols[2] || "0";
          const merchant = cols[3] || desc;
          const category = cols[4] || "Uncategorized";

          const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ""));
          
          return {
            date: new Date(dateStr).toISOString().split('T')[0], // Try to parse date
            description: desc,
            amount: Math.abs(amount),
            type: (amount < 0 ? "debit" : "credit") as "credit" | "debit", // Assume negative is debit
            merchant: merchant,
            category: category
          };
        }).filter(item => !isNaN(item.amount) && item.date !== "Invalid Date");

        if (parsed.length === 0) {
            throw new Error("No valid transactions found in CSV");
        }

        setParsedData(parsed);
        setStep("preview");
      } catch (err) {
        errorToast((err as Error).message || "Failed to parse CSV");
        setFile(null);
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async (transactions: ParsedTransaction[]) => {
      let completed = 0;
      const results = [];
      
      // Process sequentially to avoid overwhelming the server (or use Promise.all with chunks)
      for (const t of transactions) {
        try {
          const formData: TransactionFormData = {
            card_id: selectedCardId,
            transaction_date: t.date,
            merchant_name: t.merchant,
            merchant_category: t.category,
            amount: t.amount,
            transaction_type: t.type,
            description: t.description
          };
          
          await transactionApi.createTransaction(formData);
          results.push({ success: true });
        } catch (err) {
          results.push({ success: false, error: err });
        }
        
        completed++;
        setProgress(Math.round((completed / transactions.length) * 100));
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      
      success(`Imported ${successCount} transactions successfully.`);
      if (failCount > 0) {
        errorToast(`Failed to import ${failCount} transactions.`);
      }
      
      handleClose();
    },
    onError: () => {
      errorToast("An error occurred during import");
      setStep("preview");
    }
  });

  const handleImport = () => {
    if (!selectedCardId) {
      errorToast("Please select a card");
      return;
    }
    setStep("importing");
    importMutation.mutate(parsedData);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Transactions">
      <div className="space-y-6">
        {step === "upload" && (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-muted-text/30 rounded-lg p-8 text-center hover:bg-hover-bg transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-secondary-text mx-auto mb-4" />
              <p className="text-primary-text font-medium">Click to upload CSV</p>
              <p className="text-sm text-secondary-text mt-2">
                Format: Date, Description, Amount, Merchant, Category
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileChange}
              />
            </div>
            
            <div className="bg-blue-500/10 text-blue-500 p-4 rounded-lg text-sm flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <p>
                Ensure your CSV has headers and follows the format. 
                Negative amounts are treated as debits (expenses).
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card-bg p-4 rounded-lg border border-muted-text/20">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-primary-green mr-3" />
                <div>
                  <p className="font-medium text-primary-text">{file?.name}</p>
                  <p className="text-xs text-secondary-text">{parsedData.length} transactions found</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setStep("upload"); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Card *</label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-input-bg text-primary-text border-input-border focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
              >
                <option value="">Choose a card...</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_name} ({card.last_four_digits})
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-60 overflow-y-auto border border-muted-text/20 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-hover-bg sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-medium text-secondary-text">Date</th>
                    <th className="p-2 text-left font-medium text-secondary-text">Merchant</th>
                    <th className="p-2 text-right font-medium text-secondary-text">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-muted-text/10">
                      <td className="p-2 text-primary-text">{row.date}</td>
                      <td className="p-2 text-primary-text">{row.merchant}</td>
                      <td className={cn("p-2 text-right font-medium", row.type === "debit" ? "text-error" : "text-success")}>
                        {row.type === "debit" ? "-" : "+"}{row.amount}
                      </td>
                    </tr>
                  ))}
                  {parsedData.length > 10 && (
                    <tr>
                      <td colSpan={3} className="p-2 text-center text-secondary-text text-xs">
                        ...and {parsedData.length - 10} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleImport} disabled={!selectedCardId}>
                Import {parsedData.length} Transactions
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="text-center py-8 space-y-4">
            <div className="w-full bg-hover-bg rounded-full h-4 overflow-hidden">
              <div 
                className="bg-primary-green h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-primary-text font-medium">Importing transactions... {progress}%</p>
            <p className="text-sm text-secondary-text">Please do not close this window.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
