import React from 'react';

interface AdminInstructionsProps {
  showCompact?: boolean;
}

export function AdminInstructions({ showCompact = false }: AdminInstructionsProps) {
  if (showCompact) {
    return (
      <p className="text-sm text-muted-foreground">
        Anda memerlukan akses admin. Hubungi administrator untuk mendapatkan akses.
      </p>
    );
  }
  
  return (
    <div className="mt-2 text-sm">
      <p>Anda tidak memiliki akses admin. Untuk mendapatkan akses:</p>
      <ol className="list-decimal ml-5 mt-2">
        <li>Login ke Supabase dan pergi ke Authentication &rarr; Users</li>
        <li>Edit user Anda dan tambahkan role admin di Raw User Meta Data:
          <pre className="bg-gray-100 p-2 mt-1 text-xs rounded">
            {`{\n  "role": "admin"\n}`}
          </pre>
        </li>
        <li>Buat RLS policy di Supabase SQL Editor:
          <pre className="bg-gray-100 p-2 mt-1 text-xs rounded overflow-x-auto">
            {`CREATE POLICY "Allow admins to insert biodata_siswa"
ON public.biodata_siswa
FOR INSERT
TO authenticated
USING (
  (auth.jwt() ->> 'role')::text = 'admin'
);`}
          </pre>
        </li>
        <li>Refresh browser dan coba kembali</li>
      </ol>
    </div>
  );
}
