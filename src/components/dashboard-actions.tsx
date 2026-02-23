"use client";

import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { PerizinanManualDialog } from "~/components/perizinan-manual-dialog";
import { Card, CardContent } from "~/components/ui/card";

export function DashboardActions() {
    return (
        <Card>
            <CardContent className="flex flex-wrap gap-3 py-4">
                <AbsenManualDialog />
                <PerizinanManualDialog />
            </CardContent>
        </Card>
    );
}
