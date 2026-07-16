"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { warehouseNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatEtaWIB } from "@/lib/format";
import { PackagePlus, Clock, CheckCircle, Truck, Ban } from "lucide-react";
import type { PickupRequestOut } from "@/types/api";

function DashboardContent() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<PickupRequestOut[]>("/pickup-requests").then(setRequests).catch(() => setError("Failed to load requests"));
  }, []);

  const counts = requests?.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const statCards = [
    { label: "Pending", value: counts["pending"] ?? 0, icon: <Clock className="h-4 w-4 text-yellow-500" /> },
    { label: "Assigned", value: (counts["assigned"] ?? 0) + (counts["optimized"] ?? 0), icon: <Truck className="h-4 w-4 text-blue-500" /> },
    { label: "In Transit", value: counts["in_transit"] ?? 0, icon: <Truck className="h-4 w-4 text-purple-500" /> },
    { label: "Completed", value: counts["completed"] ?? 0, icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
  ];

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              {s.icon}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick action */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Requests</h2>
        <Link href="/warehouse/requests/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          <PackagePlus className="mr-2 h-4 w-4" />
          New Request
        </Link>
      </div>

      {/* Recent requests table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destination</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.slice(0, 8).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.destination_name}</TableCell>
                  <TableCell>{r.pickup_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatEtaWIB(r.estimated_arrival)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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

export default function WarehouseDashboardPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="Dashboard">
        <DashboardContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
