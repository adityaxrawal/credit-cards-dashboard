import { apiClient } from "../api-client";

export interface Statement {
  id: string;
  filename: string;
  uploadDate: string;
  status: "processing" | "completed" | "failed";
  url?: string;
  size?: number;
}

export const statementsApi = {
  getStatements: async () => {
    // Assuming the API returns { success: true, data: { statements: [...] } } or just { statements: [...] }
    // Based on other APIs, it seems to return { data: ... }
    const response = await apiClient.get<{ statements: Statement[] }>("/api/statements");
    return response.data?.statements || [];
  },
  uploadStatement: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<{ statement: Statement }>("/api/statements/upload", formData);
    return response.data?.statement;
  },
  deleteStatement: async (id: string) => {
    return apiClient.delete(`/api/statements/${id}`);
  },
};
