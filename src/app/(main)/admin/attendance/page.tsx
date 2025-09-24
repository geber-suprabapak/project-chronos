"use client";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { DatePicker } from "~/components/date-picker";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";

export default function AttendanceConfigUnifiedPage() {
  // Radius settings
  const { data: settings } = api.attendanceSettings.get.useQuery();
  const utils = api.useUtils();
  const upsertSettings = api.attendanceSettings.upsert.useMutation({
    onSuccess: () => utils.attendanceSettings.get.invalidate(),
  });
  const [lat,setLat]=useState<number|''>('');
  const [lng,setLng]=useState<number|''>('');
  const [radius,setRadius]=useState<number|''>('');
  useEffect(()=>{ if(settings){ setLat(settings.centerLatitude); setLng(settings.centerLongitude); setRadius(settings.radiusMeters);} },[settings]);

  // (Jadwal Default dihapus sesuai permintaan)

  // Special days
  const { data: specialDays, refetch: refetchSpecial } = api.attendanceSpecialDays.list.useQuery();
  const upsertSpecial = api.attendanceSpecialDays.upsert.useMutation({ onSuccess: ()=> { refetchSpecial(); resetSpecial(); } });
  const deleteSpecial = api.attendanceSpecialDays.delete.useMutation({ onSuccess: ()=> refetchSpecial() });
  const [specialForm,setSpecialForm]=useState({ id:'', date:'', type:'holiday', name:'', startTime:'', endTime:'', note:'' });
  const resetSpecial=()=> setSpecialForm({ id:'', date:'', type:'holiday', name:'', startTime:'', endTime:'', note:'' });
  const submitSpecial=(e:React.FormEvent)=>{ e.preventDefault(); const payload:any={...specialForm}; if(!payload.id) delete payload.id; if(!payload.startTime) delete payload.startTime; if(!payload.endTime) delete payload.endTime; if(!payload.name) delete payload.name; if(!payload.note) delete payload.note; upsertSpecial.mutate(payload); };

  const submitRadius=(e:React.FormEvent)=>{ e.preventDefault(); if(lat===''||lng===''||radius==='') return; upsertSettings.mutate({ centerLatitude:Number(lat), centerLongitude:Number(lng), radiusMeters:Number(radius), id: settings?.id }); };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <h1 className="text-xl font-semibold">Zona & Jadwal Absensi</h1>

  <Card className="w-full">
        <CardHeader><CardTitle>Radius Lokasi</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submitRadius} className="space-y-4">
            <div><label className="text-sm font-medium">Latitude</label><Input type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value===''?'':Number(e.target.value))} required /></div>
            <div><label className="text-sm font-medium">Longitude</label><Input type="number" step="0.000001" value={lng} onChange={e=>setLng(e.target.value===''?'':Number(e.target.value))} required /></div>
            <div><label className="text-sm font-medium">Radius (meter)</label><Input type="number" min={10} max={10000} value={radius} onChange={e=>setRadius(e.target.value===''?'':Number(e.target.value))} required /></div>
            <Button type="submit" disabled={upsertSettings.status==='pending'}>{upsertSettings.status==='pending'? 'Menyimpan...':'Simpan'}</Button>
            {upsertSettings.status==='success' && <p className="text-xs text-green-600">Tersimpan.</p>}
            {upsertSettings.status==='error' && <p className="text-xs text-red-600">Gagal menyimpan.</p>}
          </form>
          <div className="mt-6 space-y-2">
            <p className="text-xs text-muted-foreground">Klik pada peta untuk memilih titik pusat. Lingkaran menunjukkan radius.</p>
            <MapSection lat={lat} lng={lng} radius={radius} onSelect={(la,lo)=>{ setLat(la); setLng(lo); }} />
          </div>
        </CardContent>
      </Card>

      {/* Section Jadwal Default telah dihapus */}

      <Card>
        <CardHeader><CardTitle>Hari Khusus</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={submitSpecial} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 items-end">
            <div className="flex flex-col gap-1 md:col-span-1 col-span-full">
              <DatePicker
                id="special-date"
                label="Tanggal"
                locale="id-ID"
                value={specialForm.date ? new Date(specialForm.date + 'T00:00:00') : undefined}
                placeholder="Pilih tanggal"
                onChange={(d)=> setSpecialForm(f=>({ ...f, date: d ? d.toISOString().split('T')[0]! : '' }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Tipe</label>
              <Select value={specialForm.type} onValueChange={(val)=> setSpecialForm(f=>({...f, type: val as typeof f.type}))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="holiday">Libur</SelectItem>
                  <SelectItem value="early_dismissal">Pulang Awal</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1"><label className="text-xs font-medium">Nama</label><Input value={specialForm.name} onChange={e=>setSpecialForm(f=>({...f,name:e.target.value}))} placeholder="Opsional" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs font-medium">Mulai (override)</label><Input type="time" value={specialForm.startTime} onChange={e=>setSpecialForm(f=>({...f,startTime:e.target.value}))} /></div>
            <div className="flex flex-col gap-1"><label className="text-xs font-medium">Akhir (override)</label><Input type="time" value={specialForm.endTime} onChange={e=>setSpecialForm(f=>({...f,endTime:e.target.value}))} /></div>
            <div className="flex flex-col gap-1 col-span-full md:col-span-3 lg:col-span-2"><label className="text-xs font-medium">Catatan</label><Input value={specialForm.note} onChange={e=>setSpecialForm(f=>({...f,note:e.target.value}))} placeholder="Opsional" /></div>
            <div className="flex gap-2 col-span-full"><Button type="submit" disabled={upsertSpecial.status==='pending'}>{specialForm.id? 'Update':'Tambah'}</Button><Button type="button" variant="outline" onClick={resetSpecial}>Reset</Button></div>
            {upsertSpecial.status==='success' && <p className="text-xs text-green-600 col-span-full">Tersimpan.</p>}
            {upsertSpecial.status==='error' && <p className="text-xs text-red-600 col-span-full">Gagal menyimpan.</p>}
          </form>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Daftar Hari Khusus</h3>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left px-2 py-1">Tanggal</th><th className="text-left px-2 py-1">Tipe</th><th className="text-left px-2 py-1">Nama</th><th className="text-left px-2 py-1">Mulai</th><th className="text-left px-2 py-1">Akhir</th><th className="text-left px-2 py-1">Catatan</th><th className="text-right px-2 py-1">Aksi</th></tr></thead>
                <tbody>
                  {specialDays?.map((row: { id:string; date:string; type:string; name:string|null; startTime:string|null; endTime:string|null; note:string|null }) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-2 py-1 font-mono text-xs">{row.date}</td>
                      <td className="px-2 py-1">{row.type}</td>
                      <td className="px-2 py-1">{row.name || '-'}</td>
                      <td className="px-2 py-1">{row.startTime || '-'}</td>
                      <td className="px-2 py-1">{row.endTime || '-'}</td>
                      <td className="px-2 py-1">{row.note || '-'}</td>
                      <td className="px-2 py-1 text-right flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={()=>setSpecialForm({ id:row.id, date:row.date, type:row.type as any, name:row.name||'', startTime:row.startTime||'', endTime:row.endTime||'', note:row.note||'' })}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={()=>deleteSpecial.mutate({ id: row.id })} disabled={deleteSpecial.status==='pending'}>Hapus</Button>
                      </td>
                    </tr>
                  ))}
                  {!specialDays?.length && <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground text-xs">Belum ada data.</td></tr>}
                </tbody>
              </table>
            </div>
            {deleteSpecial.status==='error' && <p className="text-xs text-red-600">Gagal menghapus.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Dinamis load Leaflet components (hindari SSR crash)
const LeafletMap = dynamic(async () => {
  const L = await import("leaflet");
  // Fix default icon path (Leaflet expects images in /)
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  const { MapContainer, TileLayer, Marker, Circle, useMapEvents } = await import("react-leaflet");
  return ({ lat, lng, radius, onSelect } : { lat: number|''; lng: number|''; radius: number|''; onSelect:(la:number,lo:number)=>void }) => {
    const center = (typeof lat === 'number' && typeof lng === 'number') ? [lat,lng] as [number,number] : [-6.914744,107.60981];
    function Clicker(){
      useMapEvents({ click(e: any){ onSelect(e.latlng.lat, e.latlng.lng); } });
      return null;
    }
    return (
      <MapContainer center={center as any} zoom={16} className="h-72 w-full rounded-md overflow-hidden border">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        {typeof lat === 'number' && typeof lng === 'number' && <Marker position={[lat,lng] as any} />}
        {typeof lat === 'number' && typeof lng === 'number' && typeof radius === 'number' && <Circle center={[lat,lng] as any} radius={radius as number} pathOptions={{ color:'#2563eb', fillColor:'#3b82f6', fillOpacity:0.15 }} />}
        <Clicker />
      </MapContainer>
    );
  };
}, { ssr:false });

function MapSection({ lat, lng, radius, onSelect }:{ lat:number|''; lng:number|''; radius:number|''; onSelect:(la:number,lo:number)=>void }) {
  return <LeafletMap lat={lat} lng={lng} radius={radius} onSelect={onSelect} />;
}