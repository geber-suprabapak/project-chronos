"use client";

import { useState } from "react";
import { Bell, X, CheckCircle, AlertCircle, Info, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";

type NotificationType = "success" | "warning" | "info" | "error";

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    action?: {
        label: string;
        href: string;
    };
}

// Mock notifications - in real app, this would come from your API
const mockNotifications: Notification[] = [
    {
        id: "1",
        type: "info",
        title: "Absensi Hari Ini",
        message: "85% siswa sudah melakukan absensi hari ini",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        read: false,
    },
    {
        id: "2",
        type: "warning",
        title: "Perizinan Pending",
        message: "Ada 3 perizinan yang menunggu persetujuan",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        read: false,
        action: {
            label: "Lihat Perizinan",
            href: "/perizinan",
        },
    },
    {
        id: "3",
        type: "success",
        title: "Data Berhasil Diexport",
        message: "Export data absensi bulan ini telah selesai",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        read: true,
    },
    {
        id: "4",
        type: "error",
        title: "Gagal Import Data",
        message: "Import data gagal, silakan periksa format file",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        read: true,
    },
];

const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
        case "success":
            return <CheckCircle className="h-4 w-4 text-green-600" />;
        case "warning":
            return <AlertCircle className="h-4 w-4 text-yellow-600" />;
        case "error":
            return <AlertCircle className="h-4 w-4 text-red-600" />;
        case "info":
        default:
            return <Info className="h-4 w-4 text-blue-600" />;
    }
};

const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Baru saja";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit lalu`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam lalu`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} hari lalu`;

    return date.toLocaleDateString("id-ID");
};

export function NotificationCenter() {
    const [notifications, setNotifications] = useState(mockNotifications);
    const [isOpen, setIsOpen] = useState(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev =>
            prev.map(n => ({ ...n, read: true }))
        );
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                    )}
                    <span className="sr-only">Notifikasi</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <Card className="border-0 shadow-none">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Notifikasi</CardTitle>
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={markAllAsRead}
                                    className="text-xs"
                                >
                                    Tandai semua dibaca
                                </Button>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <CardDescription>
                                {unreadCount} notifikasi belum dibaca
                            </CardDescription>
                        )}
                    </CardHeader>
                    <Separator />
                    <CardContent className="p-0 max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Tidak ada notifikasi</p>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {notifications.map((notification, index) => (
                                    <div key={notification.id}>
                                        <div className={`p-4 hover:bg-muted/50 transition-colors ${!notification.read ? "bg-muted/25" : ""
                                            }`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="mt-0.5">
                                                        {getNotificationIcon(notification.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="text-sm font-medium truncate">
                                                                {notification.title}
                                                            </h4>
                                                            {!notification.read && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                {formatTimeAgo(notification.timestamp)}
                                                            </div>
                                                            {notification.action && (
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="h-auto p-0 text-xs"
                                                                    onClick={() => {
                                                                        markAsRead(notification.id);
                                                                        setIsOpen(false);
                                                                        // In real app, navigate to notification.action.href
                                                                    }}
                                                                >
                                                                    {notification.action.label}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 opacity-50 hover:opacity-100"
                                                    onClick={() => removeNotification(notification.id)}
                                                >
                                                    <X className="h-3 w-3" />
                                                    <span className="sr-only">Hapus notifikasi</span>
                                                </Button>
                                            </div>
                                        </div>
                                        {index < notifications.length - 1 && <Separator />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </PopoverContent>
        </Popover>
    );
}