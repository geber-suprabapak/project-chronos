"use client";

import { Button } from "~/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

interface DownloadExcelButtonProps {
  href: string;
  filename?: string;
  className?: string;
  disabled?: boolean;
}

export function DownloadExcelButton({
  href,
  filename,
  className,
  disabled,
}: DownloadExcelButtonProps) {
  const handleClick = async () => {
    try {
      // Fetch the Excel file from the server
      const response = await fetch(href, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Convert the response to a blob
      const blob = await response.blob();

      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a download link
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? href.split("/").pop() ?? "export.xlsx";

      // Append to the body, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Release the object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download Excel file:", error);
      toast.error("Gagal mengunduh file Excel. Silakan coba lagi.");
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="success"
      aria-label="Unduh Excel"
      className={className}
      disabled={disabled}
    >
      <DownloadIcon className="w-4 h-4 mr-2" aria-hidden="true" />
      <span>Unduh Excel</span>
    </Button>
  );
}
