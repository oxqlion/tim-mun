"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { warehouseNav } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { PickupRequestOut } from "@/types/api";

function RequestsList() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<PickupRequestOut[]>("/pickup-requests").then(setRequests).catch(() => setError("Failed to load requests"));
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>Arrive By</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.destination_name}</TableCell>
                  <TableCell>{r.pickup_date}</TableCell>
                  <TableCell className="text-muted-foreground">{r.required_arrival_date ?? "—"}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {r.items.map((it) => `${it.quantity} ${it.unit_type} ${it.commodity_name}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.estimated_arrival
                      ? new Date(r.estimated_arrival).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No requests yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="Pickup Requests">
        <RequestsList />
      </DashboardLayout>
    </RoleGuard>
  );
}
