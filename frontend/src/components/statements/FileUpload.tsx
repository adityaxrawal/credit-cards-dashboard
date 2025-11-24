"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  accept?: string;
}

export function FileUpload({ onUpload, isUploading, accept = ".pdf,.csv" }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Simple validation based on extension
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const acceptedExtensions = accept.split(",");
    
    if (acceptedExtensions.some(ext => ext.trim() === extension)) {
      setSelectedFile(file);
    } else {
      alert(`Invalid file type. Please upload ${accept}`);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary-green bg-primary-green/5"
              : "border-muted-text/20 hover:border-primary-green/50 hover:bg-hover-bg"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={accept}
            onChange={handleFileSelect}
          />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-hover-bg flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary-green" />
            </div>
            <div>
              <p className="text-lg font-medium text-primary-text">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-secondary-text mt-1">
                Supported formats: {accept.replace(/,/g, ", ")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card-bg border border-muted-text/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-lg bg-primary-green/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-green" />
              </div>
              <div>
                <p className="font-medium text-primary-text">{selectedFile.name}</p>
                <p className="text-xs text-secondary-text">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 hover:bg-hover-bg rounded-full transition-colors"
              disabled={isUploading}
            >
              <X className="w-5 h-5 text-secondary-text" />
            </button>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Statement
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
