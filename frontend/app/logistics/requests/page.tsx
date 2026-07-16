"use client";

import { useCallback, useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { logisticsNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Package, Calendar, MapPin, Warehouse, ListFilter, 
  Clock, Activity, Truck, CheckCircle, XCircle, FileText
} from "lucide-react";
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

  // Enhanced semantic status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 capitalize shadow-sm">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case "optimized":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 capitalize shadow-sm">
            <Activity className="h-3 w-3 mr-1" /> Optimized
          </Badge>
        );
      case "assigned":
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 capitalize shadow-sm">
            <Truck className="h-3 w-3 mr-1" /> Assigned
          </Badge>
        );
      case "in_transit":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 capitalize shadow-sm">
            <Truck className="h-3 w-3 mr-1 animate-pulse" /> In Transit
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 capitalize shadow-sm">
            <CheckCircle className="h-3 w-3 mr-1" /> Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 capitalize shadow-sm">
            <XCircle className="h-3 w-3 mr-1" /> Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Top Control Bar */}
      <Card className="border-none bg-muted/40 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row flex-wrap items-end gap-6 py-4">
          <div className="space-y-2 w-full sm:w-auto">
            <Label className="text-muted-foreground flex items-center gap-2">
              <ListFilter className="w-4 h-4" /> Filter by Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-background shadow-sm h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="optimized">Optimized (Planned)</SelectItem>
                <SelectItem value="assigned">Assigned to Fleet</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-full sm:w-auto">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Filter by Date
            </Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-48 bg-background shadow-sm h-10"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Requests table */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">Inbound Warehouse Orders</CardTitle>
            <Badge variant="secondary" className="font-mono text-sm">
              Total: {requests?.length ?? 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground" /> Source</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Destination</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Pickup Date</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Arrive By</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /> Items</div></TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((r) => (
                  <TableRow key={r.id} className="hover:bg-accent/10 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-bold text-foreground">{r.warehouse_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.warehouse_address ?? ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.destination_name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.pickup_date}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{r.required_arrival_date}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground text-sm">
                      {r.items.map((it) => `${it.quantity} ${it.unit_type} ${it.commodity_name}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(r.status)}
                    </TableCell>
                  </TableRow>
                ))}
                
                {requests?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-24">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">No requests found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          There are no inbound pickup requests matching your current filters.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LogisticsRequestsPage() {
  return (
    <RoleGuard role="logistics">
      <DashboardLayout navItems={logisticsNav} title="Order Requests & Tracking">
        <RequestsContent />
      </DashboardLayout>
    </RoleGuard>
  );
}