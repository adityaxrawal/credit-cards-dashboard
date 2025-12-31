export interface ImportTemplate {
    id: string;
    template_name: string;
    column_mappings: Record<string, string>;
    has_header_row: boolean;
    skip_rows: number;
    date_format: string;
}

export interface ImportPreviewRow {
    [key: string]: unknown;
}

export interface ParsedCSVResult {
    headers: string[];
    previewRows: string[][];
    totalRows: number;
}

export interface ImportPreviewResult {
    validRows: unknown[];
    invalidRows: unknown[];
    errors: string[];
}

export interface ImportHistory {
    id: string;
    original_filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_rows: number;
    imported_count: number;
    created_at: string;
}
