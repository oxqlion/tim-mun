"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout, { warehouseNav } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { 
  Package, Calendar, MapPin, Clock, Activity, 
  Truck, CheckCircle, XCircle, FileText, PackagePlus
} from "lucide-react";
import type { PickupRequestOut } from "@/types/api";

function RequestsList() {
  const [requests, setRequests] = useState<PickupRequestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<PickupRequestOut[]>("/pickup-requests")
      .then(setRequests)
      .catch(() => setError("Failed to load requests"));
  }, []);

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
      
      {/* Quick Action Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-muted">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Active Dispatch Orders</h2>
          <p className="text-sm text-muted-foreground">Manage and track your outbound warehouse requests.</p>
        </div>
        <Link href="/warehouse/requests/new">
          <Button className="shadow-sm transition-all hover:shadow-md w-full sm:w-auto">
            <PackagePlus className="mr-2 h-4 w-4" /> Create Dispatch Order
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Requests table */}
      <Card className="shadow-sm border-muted">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">Order Tracking Directory</CardTitle>
            <Badge variant="secondary" className="font-mono text-sm">
              Total: {requests?.length ?? 0}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Destination</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Pickup Date</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Must Arrive Before</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /> Items</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Live ETA</div></TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((r) => (
                  <TableRow key={r.id} className="hover:bg-accent/10 transition-colors">
                    <TableCell className="font-medium text-foreground">{r.destination_name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.pickup_date}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{r.required_arrival_date ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground text-sm">
                      {r.items.map((it) => `${it.quantity} ${it.unit_type} ${it.commodity_name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm font-medium">
                      {formatEtaWIB(r.estimated_arrival) || "—"}
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
                        <h3 className="text-lg font-semibold text-foreground mb-1">No orders found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                          Your warehouse has no active pickup requests. Create a new dispatch order to get started.
                        </p>
                        <Link href="/warehouse/requests/new">
                          <Button variant="outline">
                            <PackagePlus className="mr-2 h-4 w-4" /> Create First Order
                          </Button>
                        </Link>
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

export default function RequestsPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="Order Tracking Directory">
        <RequestsList />
      </DashboardLayout>
    </RoleGuard>
  );
}
