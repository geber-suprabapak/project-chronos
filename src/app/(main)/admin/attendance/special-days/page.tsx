"use client";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useState } from "react";

export default function HariKhususPage() {
  const { data, refetch } = api.attendanceSpecialDays.list.useQuery();
  const upsert = api.attendanceSpecialDays.upsert.useMutation({ onSuccess: () => { refetch(); resetForm(); } });
  const del = api.attendanceSpecialDays.delete.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({ id:'', date:'', type:'holiday', name:'', startTime:'', endTime:'', note:'' });
  const resetForm = () => setForm({ id:'', date:'', type:'holiday', name:'', startTime:'', endTime:'', note:'' });
  const submit = (e:React.FormEvent) => { e.preventDefault(); const payload:any = { ...form }; if(!payload.id) delete payload.id; if(!payload.startTime) delete payload.startTime; if(!payload.endTime) delete payload.endTime; if(!payload.name) delete payload.name; if(!payload.note) delete payload.note; upsert.mutate(payload); };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader><CardTitle>Hari Khusus (Libur / Pulang Awal)</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Tanggal</label>
              <Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Tipe</label>
              <select className="border rounded px-2 py-1 h-9" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="holiday">Libur</option>
                <option value="early_dismissal">Pulang Awal</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Nama</label>
              <Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Opsional" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Mulai (override)</label>
              <Input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Akhir (override)</label>
              <Input type="time" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} />
            </div>
            <div className="flex flex-col gap-1 col-span-full md:col-span-3 lg:col-span-2">
              <label className="text-xs font-medium">Catatan</label>
              <Input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Opsional" />
            </div>
            <div className="flex gap-2 col-span-full">
              <Button type="submit" disabled={upsert.status==='pending'}>{form.id? 'Update':'Tambah'}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Reset</Button>
            </div>
            {upsert.status==='success' && <p className="text-xs text-green-600 col-span-full">Tersimpan.</p>}
            {upsert.status==='error' && <p className="text-xs text-red-600 col-span-full">Gagal menyimpan.</p>}
          </form>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Daftar</h3>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-2 py-1">Tanggal</th>
                    <th className="text-left px-2 py-1">Tipe</th>
                    <th className="text-left px-2 py-1">Nama</th>
                    <th className="text-left px-2 py-1">Mulai</th>
                    <th className="text-left px-2 py-1">Akhir</th>
                    <th className="text-left px-2 py-1">Catatan</th>
                    <th className="text-right px-2 py-1">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((row: { id:string; date:string; type:string; name:string|null; startTime:string|null; endTime:string|null; note:string|null }) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-2 py-1 font-mono text-xs">{row.date}</td>
                      <td className="px-2 py-1">{row.type}</td>
                      <td className="px-2 py-1">{row.name || '-'}</td>
                      <td className="px-2 py-1">{row.startTime || '-'}</td>
                      <td className="px-2 py-1">{row.endTime || '-'}</td>
                      <td className="px-2 py-1">{row.note || '-'}</td>
                      <td className="px-2 py-1 text-right flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={()=>setForm({ id:row.id, date:row.date, type:row.type as any, name:row.name||'', startTime:row.startTime||'', endTime:row.endTime||'', note:row.note||'' })}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={()=>del.mutate({ id: row.id })} disabled={del.status==='pending'}>Hapus</Button>
                      </td>
                    </tr>
                  ))}
                  {!data?.length && <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground text-xs">Belum ada data.</td></tr>}
                </tbody>
              </table>
            </div>
            {del.status==='error' && <p className="text-xs text-red-600">Gagal menghapus.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
