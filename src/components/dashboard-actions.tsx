"use client";

import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { PerizinanManualDialog } from "~/components/perizinan-manual-dialog";
import { Card, CardContent } from "~/components/ui/card";

export function DashboardActions() {
    return (
        <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-4">
                <AbsenManualDialog variant="card" />
                <PerizinanManualDialog variant="card" />
            </CardContent>
        </Card>
    );
}
