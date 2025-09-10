"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover"

function formatDate(date: Date | undefined, locale = "en-US") {
    if (!date) return ""
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function isValidDate(date: Date | undefined) {
    if (!date) {
        return false
    }
    return !isNaN(date.getTime())
}

export type DatePickerProps = {
    id?: string
    label?: string
    value?: Date
    onChange?: (date: Date | undefined) => void
    placeholder?: string
    locale?: string
}

export function DatePicker({
    id = "date",
    label = "Date",
    value,
    onChange,
    placeholder = "Select a date",
    locale = "en-US",
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [month, setMonth] = React.useState<Date | undefined>(value)
    const [text, setText] = React.useState<string>(formatDate(value, locale))

    // keep text in sync if external value changes
    React.useEffect(() => {
        setText(formatDate(value, locale))
        setMonth(value)
    }, [value, locale])

    return (
        <div className="flex flex-col gap-3">
            <Label htmlFor={id} className="px-1">
                {label}
            </Label>
            <div className="relative flex gap-2">
                <Input
                    id={id}
                    value={text}
                    placeholder={placeholder}
                    className="bg-background pr-10"
                    onChange={(e) => {
                        const v = e.target.value
                        setText(v)
                        const d = new Date(v)
                        if (isValidDate(d)) {
                            onChange?.(d)
                            setMonth(d)
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setOpen(true)
                        }
                    }}
                />
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id={`${id}-picker`}
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                        >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Select date</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto overflow-hidden p-0"
                        align="end"
                        alignOffset={-8}
                        sideOffset={10}
                    >
                        <Calendar
                            mode="single"
                            selected={value}
                            captionLayout="dropdown"
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={(d) => {
                                onChange?.(d)
                                setText(formatDate(d, locale))
                                setOpen(false)
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    )
}

// Keep the original sample for reference if it's already used elsewhere
export function Calendar28() {
    const [open, setOpen] = React.useState(false)
    const [date, setDate] = React.useState<Date | undefined>(new Date("2025-06-01"))
    const [month, setMonth] = React.useState<Date | undefined>(date)
    const [value, setValue] = React.useState(formatDate(date, "en-US"))

    return (
        <div className="flex flex-col gap-3">
            <Label htmlFor="date" className="px-1">
                Tanggal
            </Label>
            <div className="relative flex gap-2">
                <Input
                    id="date"
                    value={value}
                    placeholder="June 01, 2025"
                    className="bg-background pr-10"
                    onChange={(e) => {
                        const d = new Date(e.target.value)
                        setValue(e.target.value)
                        if (isValidDate(d)) {
                            setDate(d)
                            setMonth(d)
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setOpen(true)
                        }
                    }}
                />
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            id="date-picker"
                            variant="ghost"
                            className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                        >
                            <CalendarIcon className="size-3.5" />
                            <span className="sr-only">Select date</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={-8} sideOffset={10}>
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            month={month}
                            onMonthChange={setMonth}
                            onSelect={(d) => {
                                setDate(d)
                                setValue(formatDate(d, "en-US"))
                                setOpen(false)
                            }}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    )
}
