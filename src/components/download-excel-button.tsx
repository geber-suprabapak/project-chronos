"use client";

import { Button } from "~/components/ui/button";
import { DownloadIcon } from "lucide-react";

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
      alert("Failed to download Excel file. Please try again.");
    }
  };
  
  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="outline"
      className={className}
      disabled={disabled}
    >
      <DownloadIcon className="w-4 h-4 mr-2" />
      Download Excel
    </Button>
  );
}
