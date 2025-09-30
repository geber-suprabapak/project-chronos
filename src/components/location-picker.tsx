"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  distance?: number;
}

// Simple map component that loads Leaflet dynamically
const LeafletMap = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Circle, useMapEvents } = await import("react-leaflet");
    const L = await import("leaflet");
    
    // Fix marker icons
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    } catch (error) {
      console.warn("Failed to configure Leaflet icons:", error);
    }

    interface MapProps {
      latitude: number;
      longitude: number;
      distance: number;
      onLocationChange: (lat: number, lng: number) => void;
    }

    const MapClickHandler = ({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) => {
      useMapEvents({
        click: (e) => {
          const { lat, lng } = e.latlng;
          onLocationChange(lat, lng);
        },
      });
      return null;
    };

    return function LeafletMapComponent({ latitude, longitude, distance, onLocationChange }: MapProps) {
      return (
        <div className="w-full h-80 rounded-lg overflow-hidden border border-border">
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude, longitude]} />
            <Circle
              center={[latitude, longitude]}
              radius={distance}
              pathOptions={{
                color: "hsl(var(--primary))",
                fillColor: "hsl(var(--primary))",
                fillOpacity: 0.1,
              }}
            />
            <MapClickHandler onLocationChange={onLocationChange} />
          </MapContainer>
        </div>
      );
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Memuat peta...</p>
        </div>
      </div>
    ),
  }
);

export default function LocationPicker({ 
  latitude, 
  longitude, 
  onLocationChange, 
  distance = 500 
}: LocationPickerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Pemilih Lokasi</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latitude && longitude ? (
          <LeafletMap
            latitude={latitude}
            longitude={longitude}
            distance={distance}
            onLocationChange={onLocationChange}
          />
        ) : (
          <div className="w-full h-80 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="p-4 bg-muted/30 rounded-full inline-block">
                <MapPin className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-muted-foreground">Pilih Lokasi</h3>
                <p className="text-sm text-muted-foreground/80">
                  Isi koordinat pada form di atas untuk menampilkan peta
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}