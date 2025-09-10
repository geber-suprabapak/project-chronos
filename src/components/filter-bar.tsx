"use client"

import * as React from "react"
import { RotateCcw, ArrowUpDown, ArrowDownUp } from "lucide-react"

import { Label } from "~/components/ui/label"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DatePicker } from "~/components/date-picker"

export type FilterBarValue = {
    date?: string // YYYY-MM-DD
    query?: string
    status?: string
    sort?: "asc" | "desc"
}

export type FilterBarProps = {
    value: FilterBarValue
    onChange: (next: FilterBarValue) => void
    // status options to show; if empty or undefined, status control is hidden
    statuses?: string[]
    // labels/placeholders
    labels?: {
        date?: string
        query?: string
        status?: string
    }
    placeholders?: {
        query?: string
        date?: string
        status?: string
    }
    // whether to show sort toggle
    showSort?: boolean
    className?: string
}

export function FilterBar({ value, onChange, statuses = [], labels, placeholders, showSort = true, className }: FilterBarProps) {
    const dateValue = value.date ? new Date(value.date + "T00:00:00") : undefined
    const sort = value.sort ?? "desc"

    return (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3 ${className ?? ""}`}>
            <div className="flex items-end gap-3">
                <div className="flex flex-col">
                    <DatePicker
                        id="filter-date"
                        label={labels?.date ?? "Tanggal"}
                        value={dateValue}
                        onChange={(d) => {
                            if (!d) return onChange({ ...value, date: undefined })
                            const y = d.getFullYear()
                            const m = String(d.getMonth() + 1).padStart(2, "0")
                            const da = String(d.getDate()).padStart(2, "0")
                            onChange({ ...value, date: `${y}-${m}-${da}` })
                        }}
                        placeholder={placeholders?.date ?? "Pilih tanggal"}
                        locale="id-ID"
                    />
                </div>
                {statuses.length > 0 && (
                    <div className="flex flex-col min-w-[180px]">
                        <Label htmlFor="filter-status" className="text-sm font-medium">{labels?.status ?? "Status"}</Label>
                        <Select value={(value.status ?? "") || "all"} onValueChange={(v) => onChange({ ...value, status: v === "all" ? undefined : v })}>
                            <SelectTrigger id="filter-status" className="w-[180px]">
                                <SelectValue placeholder={placeholders?.status ?? "Pilih status"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                {statuses.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="flex flex-col">
                    <Label htmlFor="filter-q" className="text-sm font-medium">{labels?.query ?? "Cari Nama"}</Label>
                    <Input
                        id="filter-q"
                        placeholder={placeholders?.query ?? "Nama..."}
                        value={value.query ?? ""}
                        onChange={(e) => onChange({ ...value, query: e.target.value })}
                        className="min-w-[220px]"
                    />
                </div>
                {value.date && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label="Reset tanggal" onClick={() => onChange({ ...value, date: undefined })}>
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset tanggal</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            {showSort && (
                <div className="flex items-end gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    aria-label={sort === "desc" ? "Sedang: Newest. Klik untuk Oldest" : "Sedang: Oldest. Klik untuk Newest"}
                                    onClick={() => onChange({ ...value, sort: sort === "desc" ? "asc" : "desc" })}
                                >
                                    {sort === "desc" ? (
                                        <ArrowDownUp className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {sort === "desc" ? "Sedang: Newest. Klik untuk Oldest" : "Sedang: Oldest. Klik untuk Newest"}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </div>
    )
}
