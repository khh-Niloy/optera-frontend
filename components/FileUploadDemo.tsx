"use client";
import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { FileUpload, FileUploadRef } from "@/components/ui/file-upload";

export interface FileUploadDemoRef {
  triggerFileSelect: () => void;
  reset: () => void;
}

export const FileUploadDemo = forwardRef<FileUploadDemoRef, {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
  loading?: boolean;
}>(({ onUpload, disabled = false, loading = false }, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<FileUploadRef>(null);
  
  useImperativeHandle(ref, () => ({
    triggerFileSelect: () => {
      fileInputRef.current?.click();
    },
    reset: () => {
      fileUploadRef.current?.reset();
    }
  }));

  const handleFileChange = (files: File[]) => {
    console.log("Files uploaded:", files);
    onUpload(files);
  };

  return (
    <div className="w-full max-w-4xl mx-auto min-h-48 border border-dashed bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 rounded-lg">
      <FileUpload ref={fileUploadRef} onChange={handleFileChange} disabled={disabled} inputRef={fileInputRef} loading={loading} />
    </div>
  );
});

FileUploadDemo.displayName = "FileUploadDemo";
