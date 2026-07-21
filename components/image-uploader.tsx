"use client";

import { useState, useRef } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export function ImageUploader({ 
  onUpload, 
  size = "md",
  label = "Foto",
}: { 
  onUpload: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  size?: "sm" | "md";
  label?: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const result = await onUpload(formData);
    
    setIsUploading(false);
    if (result.error) {
      alert(result.error);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={inputRef}
        onChange={handleFileChange}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-1.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 transition-colors ${
          size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
        } font-bold tracking-widest uppercase disabled:opacity-50`}
      >
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UploadCloud className="h-3.5 w-3.5" />
        )}
        {isUploading ? "Enviando..." : label}
      </button>
    </div>
  );
}
