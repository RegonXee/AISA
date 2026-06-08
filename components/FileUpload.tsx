'use client';

import { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label: string;
  hint?: string;
}

export default function FileUpload({ 
  onFileSelect, 
  accept = "*", 
  label, 
  hint 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-dark-border hover:border-primary/50 bg-dark-card/50'
          }
        `}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        {selectedFile ? (
          <div className="space-y-2">
            <div className="text-primary text-3xl">📄</div>
            <p className="text-white font-medium">{selectedFile.name}</p>
            <p className="text-gray-400 text-sm">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <p className="text-gray-500 text-xs">点击或拖拽重新上传</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-500 text-3xl">📁</div>
            <p className="text-gray-300">点击或拖拽上传</p>
            {hint && <p className="text-gray-500 text-sm">{hint}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
