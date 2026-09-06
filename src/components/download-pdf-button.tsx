"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { DownloadIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DownloadPdfButtonProps {
  href: string;
  filename?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

export function DownloadPdfButton({
  href,
  filename,
  title,
  className,
  disabled,
}: DownloadPdfButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!href) return;
    setIsLoading(true);
    try {
      const response = await fetch(href, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Download gagal: status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "export.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF file:", error);
      toast.error("Gagal mengunduh file PDF. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      className={className}
      onClick={handleClick}
      variant="outline"
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-label={isLoading ? "Sedang mengunduh PDF..." : "Unduh PDF"}
      title={title}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
      ) : (
        <DownloadIcon className="w-4 h-4 mr-2" aria-hidden="true" />
      )}
      {isLoading ? "Mengunduh..." : "Unduh PDF"}
    </Button>
  );
}
