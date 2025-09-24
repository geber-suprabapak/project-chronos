"use client";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Input } from "~/components/ui/input";

const days = [
  { d:1, label:'Senin' },
  { d:2, label:'Selasa' },
  { d:3, label:'Rabu' },
  { d:4, label:'Kamis' },
  { d:5, label:'Jumat' },
];

export default function JadwalDefaultPage() {
  const { data, refetch } = api.attendanceDefaultHours.list.useQuery();
  const mutation = api.attendanceDefaultHours.upsertDay.useMutation({ onSuccess: () => refetch() });
  const [local, setLocal] = useState<Record<number,{start:string,end:string}>>({});
  const map = new Map<number,{start:string,end:string}>();
  data?.forEach((r: { id:string; dayOfWeek:number; startTime:string; endTime:string })=> map.set(r.dayOfWeek,{ start:r.startTime, end:r.endTime }));
  const merged = days.map(day=>({ ...day, ...(local[day.d] ?? map.get(day.d)) }));

  const updateField = (d:number, key:'start'|'end', value:string) => {
    setLocal(prev=>({ ...prev, [d]: { start: key==='start'?value:(prev[d]?.start||''), end: key==='end'?value:(prev[d]?.end||'') } }));
  };
  const save = (d:number) => {
    const row = local[d] || map.get(d); if (!row || !row.start || !row.end) return;
    mutation.mutate({ dayOfWeek:d, startTime: row.start, endTime: row.end });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader><CardTitle>Jadwal Default (Jam Masuk / Pulang)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {merged.map(day => (
            <div key={day.d} className="flex flex-wrap items-end gap-2 border-b pb-3">
              <div className="w-32 font-medium">{day.label}</div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Masuk</span>
                <Input type="time" value={day.start || ''} onChange={e=>updateField(day.d,'start',e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Pulang</span>
                <Input type="time" value={day.end || ''} onChange={e=>updateField(day.d,'end',e.target.value)} />
              </div>
              <Button size="sm" onClick={()=>save(day.d)} disabled={mutation.status==='pending'}>Simpan</Button>
            </div>
          ))}
          {mutation.status==='success' && <p className="text-xs text-green-600">Perubahan disimpan.</p>}
          {mutation.status==='error' && <p className="text-xs text-red-600">Gagal menyimpan.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
