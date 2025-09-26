"use client"

import * as React from "react"
import { RotateCcw, ArrowUpDown, ArrowDownUp, CalendarIcon } from "lucide-react"

import { Label } from "~/components/ui/label"
import { Input } from "~/components/ui/input"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { Calendar } from "~/components/ui/calendar"

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

// Helper function to format date in a readable format
function formatDate(date: Date | undefined): string {
    if (!date) return ""
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

export function FilterBar({ value, onChange, statuses = [], labels, placeholders, showSort = true, className }: FilterBarProps) {
    const dateValue = value.date ? new Date(value.date + "T00:00:00") : undefined
    const sort = value.sort ?? "desc"

    return (
        <div className={`flex flex-col gap-4 mb-3 ${className ?? ""}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full">
                <div className="flex flex-col w-full">
                    <Label htmlFor="filter-date" className="mb-2 text-sm font-medium px-0">{labels?.date ?? "Tanggal"}</Label>
                    <div className="relative flex gap-2">
                        <Input
                            id="filter-date"
                            placeholder={placeholders?.date ?? "Pilih tanggal"}
                            value={formatDate(dateValue)}
                            onChange={(e) => {
                                const v = e.target.value
                                const d = new Date(v)
                                if (!isNaN(d.getTime())) {
                                    const y = d.getFullYear()
                                    const m = String(d.getMonth() + 1).padStart(2, "0")
                                    const da = String(d.getDate()).padStart(2, "0")
                                    onChange({ ...value, date: `${y}-${m}-${da}` })
                                }
                            }}
                            className="w-full pr-10"
                        />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
                                >
                                    <CalendarIcon className="size-3.5" />
                                    <span className="sr-only">Pilih tanggal</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end" alignOffset={-8}>
                                <Calendar
                                    mode="single"
                                    selected={dateValue}
                                    onSelect={(d) => {
                                        if (!d) return onChange({ ...value, date: undefined })
                                        const y = d.getFullYear()
                                        const m = String(d.getMonth() + 1).padStart(2, "0")
                                        const da = String(d.getDate()).padStart(2, "0")
                                        onChange({ ...value, date: `${y}-${m}-${da}` })
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                {statuses.length > 0 && (
                    <div className="flex flex-col w-full">
                        <Label htmlFor="filter-status" className="mb-2 text-sm font-medium">{labels?.status ?? "Status"}</Label>
                        <Select value={(value.status ?? "") || "all"} onValueChange={(v) => onChange({ ...value, status: v === "all" ? undefined : v })}>
                            <SelectTrigger id="filter-status" className="w-full h-9">
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
                <div className="flex flex-col w-full">
                    <Label htmlFor="filter-q" className="mb-2 text-sm font-medium">{labels?.query ?? "Cari Nama"}</Label>
                    <div className="flex gap-2">
                        <Input
                            id="filter-q"
                            placeholder={placeholders?.query ?? "Nama..."}
                            value={value.query ?? ""}
                            onChange={(e) => onChange({ ...value, query: e.target.value })}
                            className="w-full"
                        />
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
                </div>
            </div>
            {showSort && (
                <div className="flex justify-start md:justify-end mt-3">
                    <div className="flex flex-col w-auto">
                        <Label className="mb-2 text-sm font-medium invisible">Sort Order</Label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="h-9 w-9"
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
                </div>
            )}
        </div>
    )
}
