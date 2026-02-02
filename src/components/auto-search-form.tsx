"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface AutoSearchFormProps {
  type: "siswa" | "profiles";
  initialValues: {
    nama?: string;
    name?: string;
    kelas?: string;
    className?: string;
    kelamin?: string;
    activated?: string;
  };
  uniqueClasses?: string[];
}

export function AutoSearchForm({
  type,
  initialValues,
  uniqueClasses = [],
}: AutoSearchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State for form fields
  const [searchTerm, setSearchTerm] = useState(
    type === "siswa" ? (initialValues.nama ?? "") : (initialValues.name ?? ""),
  );
  const [kelas, setKelas] = useState(
    type === "siswa"
      ? (initialValues.kelas ?? "ALL")
      : (initialValues.className ?? "ALL"),
  );
  const [kelamin, setKelamin] = useState(initialValues.kelamin ?? "ALL");
  const [activated, setActivated] = useState(initialValues.activated ?? "ALL");

  // Debounce effect for search term
  useEffect(() => {
    const timer = setTimeout(() => {
      updateURL();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, kelas, kelamin, activated]);

  const updateURL = () => {
    const params = new URLSearchParams();

    // Add search term
    if (searchTerm.trim()) {
      if (type === "siswa") {
        params.set("nama", searchTerm.trim());
      } else {
        params.set("name", searchTerm.trim());
      }
    }

    // Add kelas/className
    if (kelas && kelas !== "ALL") {
      if (type === "siswa") {
        params.set("kelas", kelas);
      } else {
        params.set("className", kelas);
      }
    }

    // Add kelamin (only for siswa)
    if (type === "siswa" && kelamin && kelamin !== "ALL") {
      params.set("kelamin", kelamin);
    }

    // Add activated (only for siswa)
    if (type === "siswa" && activated && activated !== "ALL") {
      params.set("activated", activated);
    }

    // Always reset to page 1 on filter change
    params.set("page", "1");

    const queryString = params.toString();
    const newURL = queryString ? `/${type}?${queryString}` : `/${type}`;

    startTransition(() => {
      router.push(newURL);
    });
  };

  const handleReset = () => {
    setSearchTerm("");
    setKelas("ALL");
    setKelamin("ALL");
    setActivated("ALL");

    startTransition(() => {
      router.push(`/${type}`);
    });
  };

  const hasActiveFilters =
    searchTerm || kelas !== "ALL" || kelamin !== "ALL" || activated !== "ALL";

  if (type === "siswa") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="flex flex-col gap-2 w-full">
          <label htmlFor="nama" className="text-sm font-medium">
            Cari Nama/NIS
          </label>
          <Input
            id="nama"
            placeholder="Masukkan nama atau NIS siswa"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label htmlFor="kelas" className="text-sm font-medium">
            Kelas
          </label>
          <Select value={kelas} onValueChange={setKelas} disabled={isPending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kelas</SelectItem>
              {uniqueClasses.map((kelasName) => (
                <SelectItem key={kelasName} value={kelasName}>
                  {kelasName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label htmlFor="kelamin" className="text-sm font-medium">
            Jenis Kelamin
          </label>
          <Select
            value={kelamin}
            onValueChange={setKelamin}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="L">Laki-laki</SelectItem>
              <SelectItem value="P">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label htmlFor="activated" className="text-sm font-medium">
            Status Aktivasi
          </label>
          <Select
            value={activated}
            onValueChange={setActivated}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua</SelectItem>
              <SelectItem value="true">Sudah Diaktifkan</SelectItem>
              <SelectItem value="false">Belum Diaktifkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-end w-full">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isPending}
              className="flex-1"
            >
              Reset
            </Button>
          )}
          {isPending && (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              Memuat...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Profiles form
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <div className="flex flex-col gap-2 w-full">
        <label htmlFor="name" className="text-sm font-medium">
          Cari Nama
        </label>
        <Input
          id="name"
          placeholder="Masukkan nama"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2 w-full sm:col-span-1">
        <label htmlFor="className" className="text-sm font-medium">
          Jurusan
        </label>
        <Select value={kelas} onValueChange={setKelas} disabled={isPending}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Semua Jurusan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Jurusan</SelectItem>
            {uniqueClasses.map((className) => (
              <SelectItem key={className} value={className}>
                {className}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 items-end w-full sm:col-span-2 md:col-span-1">
        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
            Reset
          </Button>
        )}
        {isPending && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Memuat...
          </div>
        )}
      </div>
    </div>
  );
}
