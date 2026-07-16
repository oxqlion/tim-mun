"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { Package } from "lucide-react";
import type { PickupRequestOut, RequestStatus } from "@/types/api";

function RequestsContent() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status_filter", statusFilter);
    if (dateFilter) params.set("date", dateFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";

    api
      .get<PickupRequestOut[]>(`/pickup-requests/all${qs}`)
      .then(setRequests)
      .catch(() => setError("Failed to load requests"));
  }, [statusFilter, dateFilter]);

  useEffect(() => load(), [load]);

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "outline";
      case "assigned": return "default";
      case "optimized": return "default";
      case "in_transit": return "secondary";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="optimized">Optimized</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Pickup Date</Label>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Requests table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source (Warehouse)</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>Arrive By</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{r.warehouse_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.warehouse_address ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{r.destination_name}</TableCell>
                  <TableCell>{r.pickup_date}</TableCell>
                  <TableCell className="text-muted-foreground">{r.required_arrival_date}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {r.items.map((it) => `${it.quantity} ${it.unit_type} ${it.commodity_name}`).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(r.status) as "default" | "secondary" | "destructive" | "outline"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {requests?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No requests found.</p>
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

export default function LogisticsRequestsPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Pickup Requests">
        <RequestsContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
