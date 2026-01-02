
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const rename = promisify(fs.rename);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const PROJECT_ROOT = path.resolve(__dirname, '../');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

interface MoveConfig {
    module: string;
    moves: { from: string; to: string }[];
}

const CONFIG: MoveConfig[] = [
    // Batch 1
    {
        module: 'bills',
        moves: [
            { from: 'services/bills/BillsService.ts', to: 'modules/bills/bills.service.ts' },
            { from: 'controllers/bills.controller.ts', to: 'modules/bills/bills.controller.ts' },
            { from: 'repositories/BillRepository.ts', to: 'modules/bills/bills.repository.ts' },
            { from: 'repositories/BillAlertsRepository.ts', to: 'modules/bills/bill-alerts.repository.ts' },
            { from: 'routes/bills.routes.ts', to: 'modules/bills/bills.routes.ts' }
        ]
    },
    {
        module: 'budget',
        moves: [
            { from: 'services/bills/BudgetService.ts', to: 'modules/budget/budget.service.ts' },
            { from: 'controllers/budget.controller.ts', to: 'modules/budget/budget.controller.ts' },
            { from: 'repositories/BudgetRepository.ts', to: 'modules/budget/budget.repository.ts' },
            { from: 'routes/budget.routes.ts', to: 'modules/budget/budget.routes.ts' }
        ]
    },
    {
        module: 'cards',
        moves: [
            { from: 'services/cards/CardsService.ts', to: 'modules/cards/cards.service.ts' },
            { from: 'controllers/cards.controller.ts', to: 'modules/cards/cards.controller.ts' },
            { from: 'repositories/CreditCardRepository.ts', to: 'modules/cards/credit-card.repository.ts' },
            { from: 'repositories/DebitCardRepository.ts', to: 'modules/cards/debit-card.repository.ts' },
            { from: 'routes/cards.routes.ts', to: 'modules/cards/cards.routes.ts' }
        ]
    },
    {
        module: 'categories',
        moves: [
            { from: 'services/categories/CategoryService.ts', to: 'modules/categories/category.service.ts' },
            { from: 'controllers/categories.controller.ts', to: 'modules/categories/categories.controller.ts' },
            { from: 'repositories/CategoryRepository.ts', to: 'modules/categories/categories.repository.ts' },
            { from: 'routes/categories.routes.ts', to: 'modules/categories/categories.routes.ts' }
        ]
    },
    {
        module: 'dashboard',
        moves: [
            { from: 'controllers/dashboard.controller.ts', to: 'modules/dashboard/dashboard.controller.ts' },
            { from: 'repositories/DashboardRepository.ts', to: 'modules/dashboard/dashboard.repository.ts' },
            { from: 'routes/dashboard.routes.ts', to: 'modules/dashboard/dashboard.routes.ts' }
        ]
    },
    {
        module: 'goals',
        moves: [
            { from: 'controllers/goals.controller.ts', to: 'modules/goals/goals.controller.ts' },
            { from: 'repositories/GoalsRepository.ts', to: 'modules/goals/goals.repository.ts' },
            { from: 'routes/goals.routes.ts', to: 'modules/goals/goals.routes.ts' }
        ]
    },
    {
        module: 'loans',
        moves: [
            { from: 'controllers/loans.controller.ts', to: 'modules/loans/loans.controller.ts' },
            { from: 'repositories/LoansRepository.ts', to: 'modules/loans/loans.repository.ts' },
            { from: 'repositories/LoanRepository.ts', to: 'modules/loans/loan.repository.ts' },
            { from: 'routes/loans.routes.ts', to: 'modules/loans/loans.routes.ts' }
        ]
    },
    {
        module: 'reports',
        moves: [
            { from: 'controllers/reports.controller.ts', to: 'modules/reports/reports.controller.ts' },
            { from: 'repositories/ReportRepository.ts', to: 'modules/reports/reports.repository.ts' },
            { from: 'routes/reports.routes.ts', to: 'modules/reports/reports.routes.ts' }
        ]
    },
    {
        module: 'rewards',
        moves: [
            { from: 'services/analytics/RewardsService.ts', to: 'modules/rewards/rewards.service.ts' },
            { from: 'controllers/rewards.controller.ts', to: 'modules/rewards/rewards.controller.ts' },
            { from: 'repositories/RewardRepository.ts', to: 'modules/rewards/rewards.repository.ts' },
            { from: 'routes/rewards.routes.ts', to: 'modules/rewards/rewards.routes.ts' }
        ]
    },
    {
        module: 'rules',
        moves: [
            { from: 'services/rules/RuleService.ts', to: 'modules/rules/rules.service.ts' },
            { from: 'controllers/rules.controller.ts', to: 'modules/rules/rules.controller.ts' },
            { from: 'repositories/RuleRepository.ts', to: 'modules/rules/rules.repository.ts' },
            { from: 'routes/rules.routes.ts', to: 'modules/rules/rules.routes.ts' }
        ]
    },
    // Batch 2
    {
        module: 'alerts',
        moves: [
            { from: 'controllers/alerts.controller.ts', to: 'modules/alerts/alerts.controller.ts' },
            { from: 'repositories/AlertRepository.ts', to: 'modules/alerts/alerts.repository.ts' },
            { from: 'routes/alerts.routes.ts', to: 'modules/alerts/alerts.routes.ts' },
            // services/alerts/* - WebSocketService, AlertService
            { from: 'services/alerts/AlertsService.ts', to: 'modules/alerts/alerts.service.ts' },
            { from: 'services/alerts/WebSocketService.ts', to: 'modules/alerts/websocket.service.ts' },
            { from: 'services/alerts/WebSocketState.ts', to: 'modules/alerts/websocket-state.ts' }
        ]
    },
    {
        module: 'analytics',
        moves: [
            { from: 'controllers/analytics.controller.ts', to: 'modules/analytics/analytics.controller.ts' },
            { from: 'routes/analytics.routes.ts', to: 'modules/analytics/analytics.routes.ts' },
            { from: 'services/analytics/AnalyticsService.ts', to: 'modules/analytics/analytics.service.ts' }
        ]
    },
    {
        module: 'gmail',
        moves: [
            { from: 'controllers/gmail.controller.ts', to: 'modules/gmail/gmail.controller.ts' },
            { from: 'routes/gmail.routes.ts', to: 'modules/gmail/gmail.routes.ts' },
            { from: 'services/gmail/GmailService.ts', to: 'modules/gmail/gmail.service.ts' },
            { from: 'services/gmail/fetcher.ts', to: 'modules/gmail/gmail.fetcher.ts' },
            { from: 'services/gmail/GmailConnectionService.ts', to: 'modules/gmail/gmail-connection.service.ts' },
            { from: 'services/gmail/IngestionLogService.ts', to: 'modules/gmail/ingestion-log.service.ts' },
            { from: 'services/gmail/HistoricalScanService.ts', to: 'modules/gmail/historical-scan.service.ts' },
            { from: 'services/gmail/EmailReprocessingService.ts', to: 'modules/gmail/email-reprocessing.service.ts' }
        ]
    },
    {
        module: 'security',
        moves: [
            { from: 'controllers/security.controller.ts', to: 'modules/security/security.controller.ts' },
            { from: 'routes/security.routes.ts', to: 'modules/security/security.routes.ts' },
            { from: 'services/security/GdprService.ts', to: 'modules/security/gdpr.service.ts' },
            { from: 'services/security/UnifiedAuditService.ts', to: 'modules/security/unified-audit.service.ts' },
            { from: 'services/security/activityLogging.service.ts', to: 'modules/security/activity-logging.service.ts' },
            { from: 'services/security/auditTrail.service.ts', to: 'modules/security/audit-trail.service.ts' },
            { from: 'services/security/backupExport.service.ts', to: 'modules/security/backup-export.service.ts' },
            { from: 'services/security/transactionLock.service.ts', to: 'modules/security/transaction-lock.service.ts' },
            { from: 'repositories/AuditTrailRepository.ts', to: 'modules/security/audit-trail.repository.ts' },
            { from: 'repositories/GdprRepository.ts', to: 'modules/security/gdpr.repository.ts' },
            { from: 'repositories/ActivityLogRepository.ts', to: 'modules/security/activity-log.repository.ts' },
            { from: 'repositories/BackupExportRepository.ts', to: 'modules/security/backup-export.repository.ts' }
        ]
    },
    {
        module: 'recurring',
        moves: [
            { from: 'controllers/recurring.controller.ts', to: 'modules/recurring/recurring.controller.ts' },
            { from: 'repositories/RecurringPatternRepository.ts', to: 'modules/recurring/recurring.repository.ts' },
            { from: 'routes/recurring.routes.ts', to: 'modules/recurring/recurring.routes.ts' },
            { from: 'services/recurring/RecurringPatternService.ts', to: 'modules/recurring/recurring-pattern.service.ts' }
        ]
    },
    {
        module: 'extraction',
        moves: [
            { from: 'controllers/extraction.controller.ts', to: 'modules/extraction/extraction.controller.ts' },
            { from: 'services/extraction/ExtractionService.ts', to: 'modules/extraction/extraction.service.ts' },
            { from: 'routes/extraction.routes.ts', to: 'modules/extraction/extraction.routes.ts' }
        ]
    },
    {
        module: 'import',
        moves: [
            { from: 'controllers/import.controller.ts', to: 'modules/import/import.controller.ts' },
            { from: 'repositories/ImportRepository.ts', to: 'modules/import/import.repository.ts' },
            { from: 'routes/import.routes.ts', to: 'modules/import/import.routes.ts' }
        ]
    },
    {
        module: 'monitoring',
        moves: [
            { from: 'controllers/monitoring.controller.ts', to: 'modules/monitoring/monitoring.controller.ts' },
            { from: 'routes/monitoring.routes.ts', to: 'modules/monitoring/monitoring.routes.ts' },
            { from: 'services/infrastructure/monitoring/TransactionMonitor.ts', to: 'modules/monitoring/transaction-monitor.service.ts' }
        ]
    },
    {
        module: 'currency',
        moves: [
            { from: 'controllers/currency.controller.ts', to: 'modules/currency/currency.controller.ts' },
            { from: 'repositories/CurrencyRepository.ts', to: 'modules/currency/currency.repository.ts' },
            { from: 'routes/currency.routes.ts', to: 'modules/currency/currency.routes.ts' }
        ]
    },
    {
        module: 'shared-expense',
        moves: [
            { from: 'controllers/shared-expense.controller.ts', to: 'modules/shared-expense/shared-expense.controller.ts' },
            { from: 'repositories/SharedExpenseRepository.ts', to: 'modules/shared-expense/shared-expense.repository.ts' },
            { from: 'routes/shared-expense.routes.ts', to: 'modules/shared-expense/shared-expense.routes.ts' }
        ]
    },
    {
        module: 'transfers',
        moves: [
            { from: 'controllers/transfers.controller.ts', to: 'modules/transfers/transfers.controller.ts' },
            { from: 'services/transfers/transfer.service.ts', to: 'modules/transfers/transfers.service.ts' },
            { from: 'repositories/TransferRepository.ts', to: 'modules/transfers/transfers.repository.ts' },
            { from: 'routes/transfers.routes.ts', to: 'modules/transfers/transfers.routes.ts' }
        ]
    },
    {
        module: 'manual-review',
        moves: [
            { from: 'controllers/manual-review.controller.ts', to: 'modules/manual-review/manual-review.controller.ts' },
            { from: 'services/manual-review/ManualReviewService.ts', to: 'modules/manual-review/manual-review.service.ts' },
            { from: 'services/manual-review/UnclassifiedRepository.ts', to: 'modules/manual-review/unclassified.repository.ts' },
            { from: 'repositories/ManualReviewRepository.ts', to: 'modules/manual-review/manual-review.repository.ts' },
            { from: 'routes/manual-review.routes.ts', to: 'modules/manual-review/manual-review.routes.ts' }
        ]
    },
    // Batch 3 - Service Cleanup
    {
        module: 'analytics',
        moves: [
            { from: 'services/analytics/MetricsService.ts', to: 'modules/analytics/metrics.service.ts' }
        ]
    },
    {
        module: 'bills',
        moves: [
            { from: 'services/bills/BillAlertsService.ts', to: 'modules/bills/bill-alerts.service.ts' },
            { from: 'services/bills/BudgetRulesService.ts', to: 'modules/bills/budget-rules.service.ts' },
            { from: 'services/bills/BillAutoService.ts', to: 'modules/bills/bill-auto.service.ts' },
            { from: 'services/bills/EnvelopeBudgeting.ts', to: 'modules/bills/envelope-budgeting.service.ts' }
        ]
    },
    {
        module: 'cards',
        moves: [
            // Assuming instruments folder structure needs flattening or keeping? Plan said keeping structure inside module is fine.
            // But we prefer flat if possible or organized by feature.
            // Let's move them deep for now to avoid name collisions.
            { from: 'services/cards/instruments/BankAccountService.ts', to: 'modules/cards/bank-account.service.ts' },
            { from: 'services/cards/instruments/BankService.ts', to: 'modules/cards/bank.service.ts' },
            { from: 'services/cards/instruments/CreditCardService.ts', to: 'modules/cards/credit-card.service.ts' },
            { from: 'services/cards/instruments/DebitCardService.ts', to: 'modules/cards/debit-card.service.ts' },
            { from: 'services/cards/instruments/InstrumentAutoService.ts', to: 'modules/cards/instrument-auto.service.ts' },
            { from: 'services/cards/instruments/InstrumentHierarchyService.ts', to: 'modules/cards/instrument-hierarchy.service.ts' },
            { from: 'services/cards/instruments/InstrumentRegistry.ts', to: 'modules/cards/instrument-registry.ts' },
            { from: 'services/cards/instruments/InstrumentService.ts', to: 'modules/cards/instrument.service.ts' },
            { from: 'services/cards/instruments/UPIHandleService.ts', to: 'modules/cards/upi-handle.service.ts' }
        ]
    },
    {
        module: 'categories',
        moves: [
            { from: 'services/categories/index.ts', to: 'modules/categories/index.ts' }
        ]
    },
    {
        module: 'currency',
        moves: [
            { from: 'services/currency/currency.service.ts', to: 'modules/currency/currency.service.ts' }
        ]
    },
    {
        module: 'dashboard',
        moves: [
            { from: 'services/dashboard/dashboard.service.ts', to: 'modules/dashboard/dashboard.service.ts' }
        ]
    },
    {
        module: 'gmail',
        moves: [
            { from: 'services/gmail/ManualStatementService.ts', to: 'modules/gmail/manual-statement.service.ts' },
            { from: 'services/gmail/ManualStatementService.test.ts', to: 'modules/gmail/manual-statement.service.test.ts' }
            // sanitize folder? Script needs directory support or recursive listing.
            // Skipping directory for now, user can move manually or I update script.
        ]
    },
    {
        module: 'goals',
        moves: [
            { from: 'services/goals/goals.service.ts', to: 'modules/goals/goals.service.ts' }
        ]
    },
    {
        module: 'import',
        moves: [
            { from: 'services/import/import.service.ts', to: 'modules/import/import.service.ts' }
        ]
    },
    {
        module: 'loans',
        moves: [
            { from: 'services/loans/loans.service.ts', to: 'modules/loans/loans.service.ts' }
        ]
    },
    {
        module: 'user', // PreferenceService moved to user module
        moves: [
            { from: 'services/notifications/PreferenceService.ts', to: 'modules/user/preference.service.ts' },
            { from: 'services/user/UserProfileService.ts', to: 'modules/user/user-profile.service.ts' }
        ]
    },
    {
        module: 'processing', // Or transactions? Plan said transactions/services/processing
        moves: [
            { from: 'services/processing/PostProcessingService.ts', to: 'modules/transactions/services/processing/PostProcessingService.ts' }
        ]
    },
    {
        module: 'reports',
        moves: [
            { from: 'services/reports/ReportService.ts', to: 'modules/reports/reports.service.ts' },
            { from: 'services/reports/SchedulerService.ts', to: 'modules/reports/scheduler.service.ts' }
        ]
    },
    {
        module: 'rewards',
        moves: [
            { from: 'services/rewards/RewardCalculationService.ts', to: 'modules/rewards/reward-calculation.service.ts' }
        ]
    },
    {
        module: 'shared-expense',
        moves: [
            { from: 'services/shared/shared-expense.service.ts', to: 'modules/shared-expense/shared-expense.service.ts' }
        ]
    },
    {
        module: 'statements',
        moves: [
            { from: 'services/statements/StatementService.ts', to: 'modules/statements/statement.service.ts' },
            { from: 'services/statements/BankPDFPasswordResolver.ts', to: 'modules/statements/bank-pdf-password-resolver.ts' },
            { from: 'services/statements/StatementParserFactory.ts', to: 'modules/statements/statement-parser-factory.ts' },
            { from: 'services/statements/StatementReconciler.ts', to: 'modules/statements/statement-reconciler.ts' }
            // parsers folder skipped for now
        ]
    },
    {
        module: 'transactions', // Subscriptions
        moves: [
            { from: 'services/subscriptions/SubscriptionDetectionService.ts', to: 'modules/transactions/services/detection/subscription-detection.service.ts' }
        ]
    }
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== 'logs') {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });
    return arrayOfFiles;
}

async function main() {
    console.log(`Starting migration in ${SRC_DIR}`);

    for (const group of CONFIG) {
        console.log(`Processing module: ${group.module}`);
        const moduleDir = path.join(SRC_DIR, 'modules', group.module);

        if (!fs.existsSync(moduleDir)) {
            fs.mkdirSync(moduleDir, { recursive: true });
        }

        for (const move of group.moves) {
            const srcPath = path.join(SRC_DIR, move.from);
            const destPath = path.join(SRC_DIR, move.to);

            if (fs.existsSync(srcPath)) {
                console.log(`Move: ${move.from} -> ${move.to}`);

                // Ensure target dir exists (for nested moves)
                const targetDir = path.dirname(destPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // 1. Move
                await rename(srcPath, destPath);
            } else {
                console.warn(`SKIP: Source not found (already moved?): ${move.from}`);
            }
        }
    }

    // Post-move global replace
    console.log('Running global import updates...');

    // Naive replacement map - matches the Move logic above
    // This part is critical. It must match the FROM and TO exactly.
    // We generate replacements array dynamically based on CONFIG
    const replacements = [];

    for (const group of CONFIG) {
        for (const move of group.moves) {
            // Import: ../../repositories/BillRepository'
            // To: '@modules/bills/bills.repository'

            // Heuristic for "From" string in import
            // typically: ../path/to/File
            // We can match just the FILENAME part if it's unique enough (BillRepository is).
            const fileName = path.basename(move.from, '.ts'); // BillRepository
            const newImportPath = '@modules/' + group.module + '/' + path.basename(move.to, '.ts');

            // Regex to match imports ending with this filename
            // ex: from '.../BillRepository' or '.../BillRepository.ts' (rare) or '.../BillRepository'
            // We use a regex that looks for /Filename['"]
            replacements.push({
                pattern: new RegExp(`\/services\/[^\/]+\/${fileName}['"]`, 'g'),
                replace: `/${fileName}'`, // temp, wait
                // Let's rely on specific patterns for repositories and services
            });

            // Simple naive replacement: 
            // from '../../repositories/BillRepository' -> from '@modules/bills/bills.repository'

            // NOTE: We will do a generic replacement for specific known folders

            // Repositories
            if (move.from.includes('repositories/')) {
                const oldName = path.basename(move.from, '.ts');
                const newPath = `@modules/${group.module}/${path.basename(move.to, '.ts')}`;
                //                 console.log(`Mapping repo ${oldName} -> ${newPath}`);
                replacements.push({
                    pattern: new RegExp(`from ['"].*\/repositories\/${oldName}['"]`, 'g'),
                    replace: `from '${newPath}'`
                });
            }

            // Services (usually moved from src/services/XYZ/Service.ts)
            if (move.from.includes('services/')) {
                const oldName = path.basename(move.from, '.ts');
                const newPath = `@modules/${group.module}/${path.basename(move.to, '.ts')}`;
                //                 console.log(`Mapping service ${oldName} -> ${newPath}`);
                replacements.push({
                    pattern: new RegExp(`from ['"].*\/services\/.*${oldName}['"]`, 'g'), // fuzzy match service path
                    replace: `from '${newPath}'`
                });
            }
        }
    }

    // Read all TS files
    const files = getAllFiles(SRC_DIR);
    console.log(`Scanning ${files.length} files for imports...`);

    for (const file of files) {
        let content = await readFile(file, 'utf-8');
        let original = content;

        for (const r of replacements) {
            if (r.pattern) {
                content = content.replace(r.pattern, r.replace);
            }
        }

        // Also fix the ../../shared/ imports which we did in sed, but just in case
        content = content.replace(/from ['"]\.\.\/types\//g, "from '@shared/types/");
        // regex for generic relative path ../../shared -> @shared

        if (content !== original) {
            await writeFile(file, content);
            // console.log(`Updated imports in: ${path.relative(SRC_DIR, file)}`);
        }
    }
    console.log('Done.');
}

main().catch(console.error);
