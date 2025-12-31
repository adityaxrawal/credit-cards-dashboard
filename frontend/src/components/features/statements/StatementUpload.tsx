import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Check, AlertTriangle, Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Input, Select, Card } from '@/components/ui';
import { statementsApi } from '@/lib/api/statements';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface StatementUploadProps {
  onSuccess: () => void;
}

export function StatementUpload({ onSuccess }: StatementUploadProps) {
  const [bankName, setBankName] = useState('HDFC');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      const response = await statementsApi.upload(file, bankName, password);
      // @ts-ignore - Status field might be dynamic based on backend response
      if (response.status === 'pending_implementation') {
        throw new Error("This feature is coming soon! Manual processing is not yet enabled.");
      }
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['statements'] });
      onSuccess();
      // Reset form
      setFile(null);
      setPassword('');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx']
    },
    maxFiles: 1
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-medium mb-4">Upload Statement</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bank / Issuer</label>
          {/* Using HTML select for simplicity if Select component is complex/unknown, but trying to adapt to reported error which implies onValueChange */}
          <div className="relative">
            <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
            >
                <option value="HDFC">HDFC Bank</option>
                <option value="SBI">SBI Card</option>
                <option value="ICICI">ICICI Bank</option>
                <option value="AXIS">Axis Bank</option>
                <option value="AMEX">American Express</option>
            </select>
          </div>
        </div>

        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${file ? 'bg-gray-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="flex flex-col items-center">
              <FileText size={48} className="text-blue-500 mb-2" />
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload size={48} className="text-gray-400 mb-2" />
              <p className="text-gray-600">Drag & drop your statement here, or click to select</p>
              <p className="text-xs text-gray-400 mt-1">Supports PDF, CSV</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-gray-400 font-normal">(if encrypted)</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
              type="password" 
              className="pl-9" 
              placeholder="Statement Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {uploadMutation.isError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {(uploadMutation.error as Error).message}
          </div>
        )}

        {uploadMutation.isSuccess && uploadMutation.data && (
          <div className="bg-green-50 text-green-700 p-4 rounded-md text-sm border border-green-200">
            <div className="flex items-center gap-2 font-medium mb-2">
              <CheckCircle size={16} />
              Processed Successfully!
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/50 p-2 rounded">
                <span className="block text-gray-500">Processed</span>
                <span className="font-bold text-lg">{uploadMutation.data.stats.totalProcessed}</span>
              </div>
              <div className="bg-white/50 p-2 rounded">
                <span className="block text-gray-500">Matched</span>
                <span className="font-bold text-lg text-blue-600">{uploadMutation.data.stats.matched}</span>
              </div>
              <div className="bg-white/50 p-2 rounded">
                <span className="block text-gray-500">New / Inserted</span>
                <span className="font-bold text-lg text-amber-600">{uploadMutation.data.stats.newInserted}</span>
              </div>
              <div className="bg-white/50 p-2 rounded">
                <span className="block text-gray-500">Skipped</span>
                <span className="font-bold text-lg text-gray-400">{uploadMutation.data.stats.skipped}</span>
              </div>
            </div>
            
            <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 bg-white hover:bg-green-50"
                onClick={() => {
                   uploadMutation.reset();
                   setFile(null);
                   setPassword('');
                }}
            >
                Upload Another
            </Button>
          </div>
        )}

        {!uploadMutation.isSuccess && (
            <Button 
              className="w-full" 
              disabled={!file || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? 'Processing...' : 'Upload & Process'}
            </Button>
        )}
      </div>
    </Card>
  );
}
