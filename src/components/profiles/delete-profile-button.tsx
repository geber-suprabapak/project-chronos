"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

export function DeleteProfileButton({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const utils = api.useUtils();
  const deleteMutation = api.userProfiles.deleteById.useMutation({
    onSuccess: async () => {
      toast.success("Profil dihapus");
      // Invalidate profiles lists and any cache
      await Promise.all([
        utils.userProfiles.invalidate(),
      ]);
      onDeleted?.();
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || "Gagal menghapus profil");
    },
  });

  const handleClick = async () => {
    if (loading) return;
    const ok = window.confirm("Yakin ingin menghapus profil ini? Tindakan ini tidak dapat dibatalkan.");
    if (!ok) return;
    setLoading(true);
    try {
      await deleteMutation.mutateAsync({ id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="destructive" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? "Menghapus..." : "Hapus"}
    </Button>
  );
}
