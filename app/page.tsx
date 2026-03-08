"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  InsightsCard,
  Badge,
  Title,
  Text,
  Skeleton,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Icon,
} from "@kognitos/lattice";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { RunSummary } from "@/lib/types";
import type { TChartConfig } from "@kognitos/lattice";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stateLabel(state: string): string {
  const map: Record<string, string> = {
    completed: "Processed",
    executing: "Processing",
    pending: "Queued",
    failed: "Failed",
    awaiting_guidance: "Needs Review",
    stopped: "Stopped",
  };
  return map[state] ?? state;
}

function stateBadgeVariant(
  state: string
): "success" | "warning" | "destructive" | "secondary" | "default" {
  const map: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    completed: "success",
    executing: "warning",
    pending: "secondary",
    failed: "destructive",
    awaiting_guidance: "warning",
    stopped: "secondary",
  };
  return map[state] ?? "default";
}

const chartConfig: TChartConfig = {
  totalCharges: {
    label: "Total Charges",
    color: "var(--chart-1)",
  },
};

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs?pageSize=50")
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completedRuns = runs.filter((r) => r.state === "completed");
  const totalPatients = completedRuns.reduce((s, r) => s + r.patientCount, 0);
  const totalCharges = completedRuns.reduce((s, r) => s + r.totalCharges, 0);
  const successRate =
    runs.length > 0
      ? Math.round((completedRuns.length / runs.length) * 100)
      : 0;

  const chartData = completedRuns
    .filter((r) => r.totalCharges > 0)
    .reverse()
    .map((r, i) => ({
      name: `Batch ${i + 1}`,
      totalCharges: r.totalCharges,
      date: formatDate(r.createdAt),
    }));

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Title level="h2">Claims Dashboard</Title>
        <Text level="small" color="muted">
          Monitor claim processing batches and billing activity
        </Text>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <InsightsCard
          title="Total Batches"
          value={String(runs.length)}
        />
        <InsightsCard
          title="Patients Billed"
          value={String(totalPatients)}
        />
        <InsightsCard
          title="Total Charges"
          value={formatCurrency(totalCharges)}
        />
        <InsightsCard
          title="Success Rate"
          value={`${successRate}%`}
          variant={successRate >= 90 ? "success" : successRate >= 70 ? "default" : "destructive"}
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <Title level="h4" className="mb-4">
            Charges by Batch
          </Title>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value))}
                    labelKey="date"
                  />
                }
              />
              <Bar
                dataKey="totalCharges"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <Title level="h4">Recent Batches</Title>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead className="text-right">Total Charges</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No batches found
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{formatDate(run.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={stateBadgeVariant(run.state)}>
                      {stateLabel(run.state)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {run.patientCount > 0 ? run.patientCount : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {run.totalCharges > 0
                      ? formatCurrency(run.totalCharges)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/runs/${run.id}`}
                        className="text-sm text-link hover:underline"
                      >
                        View Details
                      </Link>
                      <a
                        href={run.kognitosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Icon type="ExternalLink" size="sm" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
