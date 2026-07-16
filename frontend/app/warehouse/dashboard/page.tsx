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
  PackagePlus, Clock, CheckCircle, Truck, 
  MapPin, Calendar, Activity, XCircle, FileText 
} from "lucide-react";
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

  // Semantic badge helper for the table
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
      
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        <Card className="bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{counts["pending"] ?? 0}</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Awaiting dispatch plan</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Assigned</CardTitle>
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{(counts["assigned"] ?? 0) + (counts["optimized"] ?? 0)}</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Scheduled to fleet</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{counts["in_transit"] ?? 0}</p>
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">Currently on route</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 shadow-sm transition-colors hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{counts["completed"] ?? 0}</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Successfully delivered</p>
          </CardContent>
        </Card>

      </div>

      {/* Quick Action Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Recent Dispatches</h2>
          <p className="text-sm text-muted-foreground">Monitor the status of your latest warehouse orders.</p>
        </div>
        <Link href="/warehouse/requests/new">
          <Button className="shadow-sm transition-all hover:shadow-md w-full sm:w-auto">
            <PackagePlus className="mr-2 h-4 w-4" /> Create Dispatch Order
          </Button>
        </Link>
      </div>

      {/* Recent requests table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Destination</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Pickup Date</div></TableHead>
                  <TableHead className="font-semibold"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> ETA</div></TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.slice(0, 8).map((r) => (
                  <TableRow key={r.id} className="hover:bg-accent/10 transition-colors">
                    <TableCell className="font-medium text-foreground">{r.destination_name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.pickup_date}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {formatEtaWIB(r.estimated_arrival) || "—"}
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(r.status)}
                    </TableCell>
                  </TableRow>
                ))}
                
                {requests?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-24">
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

export default function WarehouseDashboardPage() {
  return (
    <RoleGuard role="warehouse">
      <DashboardLayout navItems={warehouseNav} title="Warehouse Operations Hub">
        <DashboardContent />
      </DashboardLayout>
    </RoleGuard>
  );
}
