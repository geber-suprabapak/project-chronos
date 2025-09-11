"use client";
import { downloadTableAsPDF } from "~/lib/pdf";
import { Button } from "~/components/ui/button";
import { DownloadIcon } from "lucide-react";

interface DownloadPdfButtonProps {
  tableId: string;
  filename?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

export function DownloadPdfButton({ tableId, filename, title, className, disabled }: DownloadPdfButtonProps) {
  return (
    <Button
      type="button"
      className={className}
      onClick={() => downloadTableAsPDF({ tableId, filename, title })}
      variant="outline"
      disabled={disabled}
    >
      <DownloadIcon className="w-4 h-4 mr-2" />
      Download PDF
    </Button>
  );
}
