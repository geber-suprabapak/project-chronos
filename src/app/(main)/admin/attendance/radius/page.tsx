"use client";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function RadiusLokasiPage() {
  const { data } = api.attendanceSettings.get.useQuery();
  const utils = api.useUtils();
  const mutation = api.attendanceSettings.upsert.useMutation({
    onSuccess: () => utils.attendanceSettings.get.invalidate(),
  });
  const [lat, setLat] = useState<number | ''>('');
  const [lng, setLng] = useState<number | ''>('');
  const [radius, setRadius] = useState<number | ''>('');
  useEffect(() => { if (data) { setLat(data.centerLatitude); setLng(data.centerLongitude); setRadius(data.radiusMeters); } }, [data]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lat === '' || lng === '' || radius === '') return;
    mutation.mutate({ centerLatitude: Number(lat), centerLongitude: Number(lng), radiusMeters: Number(radius), id: data?.id });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <Card className="max-w-xl">
        <CardHeader><CardTitle>Radius Lokasi Absensi</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><label className="text-sm font-medium">Latitude</label><Input type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value===''?'':Number(e.target.value))} required /></div>
            <div><label className="text-sm font-medium">Longitude</label><Input type="number" step="0.000001" value={lng} onChange={e=>setLng(e.target.value===''?'':Number(e.target.value))} required /></div>
            <div><label className="text-sm font-medium">Radius (meter)</label><Input type="number" min={10} max={10000} value={radius} onChange={e=>setRadius(e.target.value===''?'':Number(e.target.value))} required /></div>
            <Button type="submit" disabled={mutation.status==='pending'}>{mutation.status==='pending'?'Menyimpan...':'Simpan'}</Button>
            {mutation.status==='success' && <p className="text-xs text-green-600">Tersimpan.</p>}
            {mutation.status==='error' && <p className="text-xs text-red-600">Gagal menyimpan.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
