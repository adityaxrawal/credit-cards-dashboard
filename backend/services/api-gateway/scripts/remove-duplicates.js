const fs = require('fs');
const path = require('path');

// For bills.service.ts - keep CRUD wrappers at end, remove earlier getBills duplicate
const billsPath = path.join(__dirname, '../src/modules/bills/bills.service.ts');
let bills = fs.readFileSync(billsPath, 'utf8');

// Find getBills method that starts around line 277 and replace it with a different name
bills = bills.replace(
  /static async getBills\(\s+userId: string,\s+options: \{[\s\S]*?\}\s*= \{\}\s*\): Promise<\{[\s\S]*?bills: BillInfo\[\];[\s\S]*?total: number;[\s\S]*?\}> \{[\s\S]*?try \{[\s\S]*?return \{[\s\S]*?bills: formattedBills,[\s\S]*?total: count \|\| formattedBills\.length,[\s\S]*?\};[\s\S]*?\} catch \(error\) \{[\s\S]*?throw error;[\s\S]*?\}\s*\}/,
  'static async getBillsDetailed(\n    userId: string,\n    options: {\n      status?: "pending" | "paid" | "overdue" | "all";\n      cardId?: string;\n      limit?: number;\n      offset?: number;\n    } = {}\n  ): Promise<{\n    bills: BillInfo[];\n    total: number;\n  }> {\n    try {\n      let query = supabase\n        .from("bills")\n        .select("*, credit_cards(card_name)")\n        .eq("user_id", userId);\n\n      if (options.status && options.status !== "all") {\n        query = query.eq("status", options.status);\n      }\n\n      if (options.cardId) {\n        query = query.eq("card_id", options.cardId);\n      }\n\n      query = query\n        .order("bill_date", { ascending: false })\n        .range(\n          options.offset || 0,\n          (options.offset || 0) + (options.limit || 50) - 1\n        );\n\n      const { data: bills, error, count } = await query;\n\n      if (error) {\n        throw new Error(`Failed to fetch bills: ${error.message}`);\n      }\n\n      const formattedBills = (bills || []).map((bill: any) => ({\n        ...bill,\n        cardName: bill.credit_cards?.card_name || "Unknown Card",\n        billDate: new Date(bill.bill_date),\n        dueDate: new Date(bill.due_date),\n        statementPeriodStart: new Date(bill.statement_period_start),\n        statementPeriodEnd: new Date(bill.statement_period_end),\n        createdAt: new Date(bill.created_at),\n        updatedAt: new Date(bill.updated_at),\n      }));\n\n      return {\n        bills: formattedBills,\n        total: count || formattedBills.length,\n      };\n    } catch (error) {\n      throw error;\n    }\n  }'
);

fs.writeFileSync(billsPath, bills);
console.log('✅ Fixed bills.service.ts duplicates');

// For reports.service.ts - comment out early getReportById if it exists
const reportsPath = path.join(__dirname, '../src/modules/reports/reports.service.ts');
let reports = fs.readFileSync(reportsPath, 'utf8');

// Find the line numbers of getReportById
const lines = reports.split('\n');
const getReportByIdLines = [];
lines.forEach((line, idx) => {
  if (line.trim().startsWith('static async getReportById')) {
    getReportByIdLines.push(idx);
  }
});

// If there are duplicates, comment out the first one
if (getReportByIdLines.length > 1) {
  const firstIdx = getReportByIdLines[0];
  let bracketCount = 0;
  let startCommented = false;
  
  for (let i = firstIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!startCommented) {
      lines[i] = '  // ' + line;
      startCommented = true;
    } else {
      lines[i] = '  // ' + line;
    }
    
    bracketCount += (line.match(/\{/g) || []).length;
    bracketCount -= (line.match(/\}/g) || []).length;
    
    if (bracketCount === 0 && startCommented) {
      break;
    }
  }
  
  reports = lines.join('\n');
  fs.writeFileSync(reportsPath, reports);
  console.log('✅ Fixed reports.service.ts duplicates');
}

// Fix subscriptions controller
const subsControllerPath = path.join(__dirname, '../src/modules/subscriptions/subscriptions.controller.ts');
let subsController = fs.readFileSync(subsControllerPath, 'utf8');

// Replace trackSubscription with addManualSubscription
subsController = subsController.replace(
  /SubscriptionService\.trackSubscription\(userId, req\.body\)/g,
  'SubscriptionService.addManualSubscription(userId, req.body)'
);

fs.writeFileSync(subsControllerPath, subsController);
console.log('✅ Fixed subscriptions controller');

console.log('\n✅ All duplicates handled!');
