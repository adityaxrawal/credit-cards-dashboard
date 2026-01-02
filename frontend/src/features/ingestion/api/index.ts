import { apiClient } from '@/lib/api-client';

// Types
export interface ImportTemplate {
    id: string;
    userId: string;
    templateName: string;
    source: string;
    dateColumn?: string;
    amountColumn?: string;
    descriptionColumn?: string;
    merchantColumn?: string;
    categoryColumn?: string;
    directionColumn?: string;
    dateFormat?: string;
    columnMapping: Record<string, string>;
    createdAt: string;
}

export interface ImportTemplateInput {
    templateName: string;
    source: string;
    dateColumn?: string;
    amountColumn?: string;
    descriptionColumn?: string;
    merchantColumn?: string;
    categoryColumn?: string;
    directionColumn?: string;
    dateFormat?: string;
    columnMapping?: Record<string, string>;
}

export interface ParsedCSV {
    headers: string[];
    rows: any[];
    preview: any[];
}

export interface ColumnMapping {
    dateColumn: string;
    amountColumn: string;
    descriptionColumn: string;
    merchantColumn?: string;
    categoryColumn?: string;
    directionColumn?: string;
    dateFormat?: string;
}

export interface ParsedTransaction {
    date: string;
    amount: number;
    description: string;
    merchant?: string;
    category?: string;
    direction: 'credit' | 'debit';
    originalRow: any;
    rowIndex: number;
}

export interface ImportPreview {
    transactions: ParsedTransaction[];
    errors: Array<{ rowIndex: number; row: any; error: string }>;
}

export interface ImportJob {
    id: string;
    userId: string;
    templateId?: string;
    fileName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalRows: number;
    processedRows: number;
    importedRows: number;
    skippedRows: number;
    duplicateRows: number;
    errorRows: number;
    errors?: any[];
    createdAt: string;
    completedAt?: string;
}

// API Functions
export const importApi = {
    /**
     * Get user's import templates
     */
    getTemplates: async (): Promise<ImportTemplate[]> => {
        const response = await apiClient.get<{ data: ImportTemplate[] }>('/api/import/templates');
        return response.data.data;
    },

    /**
     * Save import template
     */
    saveTemplate: async (template: ImportTemplateInput): Promise<ImportTemplate> => {
        const response = await apiClient.post<{ data: ImportTemplate }>('/api/import/templates', template);
        return response.data.data;
    },

    /**
     * Parse CSV content
     */
    parseCSV: async (csvContent: string, hasHeader?: boolean): Promise<ParsedCSV> => {
        const response = await apiClient.post<{ data: ParsedCSV }>('/api/import/parse', {
            csvContent,
            hasHeader: hasHeader ?? true,
        });
        return response.data.data;
    },

    /**
     * Preview import with column mapping
     */
    previewImport: async (rows: any[], mapping: ColumnMapping): Promise<ImportPreview> => {
        const response = await apiClient.post<{ data: ImportPreview }>('/api/import/preview', {
            rows,
            mapping,
        });
        return response.data.data;
    },

    /**
     * Execute import
     */
    executeImport: async (
        instrumentId: string,
        transactions: ParsedTransaction[],
        skipDuplicates?: boolean
    ): Promise<ImportJob> => {
        const response = await apiClient.post<{ data: ImportJob }>('/api/import/execute', {
            instrumentId,
            transactions,
            skipDuplicates: skipDuplicates ?? true,
        });
        return response.data.data;
    },

    /**
     * Get import history
     */
    getHistory: async (limit?: number): Promise<ImportJob[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const response = await apiClient.get<{ data: ImportJob[] }>(`/api/import/history${params}`);
        return response.data.data;
    },
};
