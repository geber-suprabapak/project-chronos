"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { MapPin, Navigation, Search, Loader2 } from "lucide-react";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  distance?: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
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
        <div className="w-full h-64 rounded-lg overflow-hidden border border-border">
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
      <div className="w-full h-64 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const getCurrentLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      setIsSearching(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          onLocationChange(lat, lng);
          setIsSearching(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsSearching(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  }, [onLocationChange]);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data: NominatimResult[] = await response.json() as NominatimResult[];
      
      if (data && data.length > 0) {
        const result = data[0];
        if (result?.lat && result?.lon) {
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          onLocationChange(lat, lng);
        }
      }
    } catch (error) {
      console.error("Error searching location:", error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, onLocationChange]);

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 via-card to-amber-50/30 dark:from-orange-950/20 dark:via-card dark:to-amber-950/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2 text-orange-700 dark:text-orange-400">
          <MapPin className="h-5 w-5" />
          <span>Pemilih Lokasi</span>
        </CardTitle>
        <CardDescription className="text-base">
          Pilih lokasi dengan pencarian alamat, GPS, atau klik langsung pada peta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Search Input */}
        <div className="space-y-3">
          <Label htmlFor="location-search" className="text-sm font-medium">Cari Lokasi</Label>
          <div className="flex gap-3">
            <Input
              id="location-search"
              type="text"
              placeholder="Masukkan alamat atau nama tempat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchLocation()}
              className="h-11"
            />
            <Button 
              onClick={searchLocation} 
              disabled={isSearching || !searchQuery.trim()}
              variant="outline"
              className="h-11 px-4"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Current Location Button */}
        <Button 
          onClick={getCurrentLocation} 
          disabled={isSearching}
          variant="outline"
          className="w-full h-12 text-base"
        >
          <Navigation className="mr-2 h-5 w-5" />
          {isSearching ? "Mencari..." : "Gunakan Lokasi Saat Ini"}
        </Button>

        {/* Interactive Map */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Peta Interaktif</Label>
          {latitude && longitude ? (
            <LeafletMap
              latitude={latitude}
              longitude={longitude}
              distance={distance}
              onLocationChange={onLocationChange}
            />
          ) : (
            <div className="w-full h-64 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="p-4 bg-muted/30 rounded-full inline-block">
                  <MapPin className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-muted-foreground">Pilih Lokasi</h3>
                  <p className="text-sm text-muted-foreground/80">
                    Gunakan pencarian atau GPS untuk menampilkan peta
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coordinate Display */}
        {latitude && longitude && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-background/80 rounded-lg text-center border">
                <Label className="text-xs text-muted-foreground block mb-1">Latitude</Label>
                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                  {latitude.toFixed(6)}
                </Badge>
              </div>
              <div className="p-3 bg-background/80 rounded-lg text-center border">
                <Label className="text-xs text-muted-foreground block mb-1">Longitude</Label>
                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                  {longitude.toFixed(6)}
                </Badge>
              </div>
            </div>
                
            {/* Distance Info */}
            {distance && (
              <div className="p-3 bg-primary/5 rounded-lg border text-center">
                <Label className="text-xs text-muted-foreground block mb-1">Radius Toleransi</Label>
                <Badge variant="outline" className="text-primary font-medium">
                  {distance} meter
                </Badge>
              </div>
            )}
                
            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                  window.open(mapsUrl, '_blank');
                }}
              >
                <MapPin className="mr-1 h-3 w-3" />
                Lihat di Maps
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard.writeText(`${latitude}, ${longitude}`);
                }}
              >
                📋 Salin
              </Button>
            </div>
          </div>
        )}

        {/* Manual Input Option */}
        <div className="pt-4 border-t border-border">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center">
              <span>Input Manual Koordinat</span>
              <span className="ml-auto group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-lat" className="text-xs font-medium">Latitude</Label>
                <Input
                  id="manual-lat"
                  type="number"
                  step="any"
                  placeholder="-7.4503"
                  value={latitude ?? ""}
                  onChange={(e) => {
                    const lat = parseFloat(e.target.value);
                    if (!isNaN(lat) && longitude) {
                      onLocationChange(lat, longitude);
                    }
                  }}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-lng" className="text-xs font-medium">Longitude</Label>
                <Input
                  id="manual-lng"
                  type="number"
                  step="any"
                  placeholder="110.2241"
                  value={longitude ?? ""}
                  onChange={(e) => {
                    const lng = parseFloat(e.target.value);
                    if (!isNaN(lng) && latitude) {
                      onLocationChange(latitude, lng);
                    }
                  }}
                  className="h-10"
                />
              </div>
            </div>
          </details>
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-gradient-to-r from-blue-50/50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/30 p-4 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">💡</span>
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Tips Penggunaan:</p>
              <ul className="space-y-1 text-blue-600/80 dark:text-blue-400/80">
                <li>• <strong>Klik langsung pada peta</strong> untuk memilih lokasi dengan mudah</li>
                <li>• Gunakan pencarian untuk menemukan alamat spesifik</li>
                <li>• Aktifkan GPS untuk mendapatkan lokasi saat ini</li>
                <li>• Lingkaran biru menunjukkan area toleransi absensi</li>
                <li>• Koordinat otomatis tersinkron dengan form utama</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}