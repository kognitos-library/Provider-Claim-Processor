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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
} from "recharts";
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

function lagColor(days: number): string {
  if (days <= 3) return "#22c55e";
  if (days <= 6) return "#f59e0b";
  return "#ef4444";
}

function lagLabel(days: number): string {
  if (days <= 3) return "On Track";
  if (days <= 6) return "Moderate";
  return "Critical";
}

const chartConfig: TChartConfig = {
  totalCharges: {
    label: "Total Charges",
    color: "var(--chart-1)",
  },
};

const lagChartConfig: TChartConfig = {
  avgLag: {
    label: "Avg Charge Lag",
    color: "var(--chart-2)",
  },
};

function ChargeLagChart({ runs }: { runs: RunSummary[] }) {
  const runsWithLag = runs
    .filter((r) => r.chargeLag.length > 0)
    .reverse();
  if (runsWithLag.length === 0) return null;

  const data = runsWithLag.map((r, i) => {
    const avg =
      r.chargeLag.reduce((s, d) => s + d.days, 0) / r.chargeLag.length;
    return {
      name: `Batch ${i + 1}`,
      avgLag: Math.round(avg * 10) / 10,
      patients: r.chargeLag.length,
      date: formatDate(r.createdAt),
    };
  });

  const overallAvg =
    Math.round(
      (data.reduce((s, d) => s + d.avgLag, 0) / data.length) * 10
    ) / 10;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between mb-1">
        <div>
          <Title level="h4">Charge Lag</Title>
          <Text level="small" color="muted">
            Average days from admission to charge submission per batch
          </Text>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
            ≤3d
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            4–6d
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            7d+
          </span>
        </div>
      </div>
      <ChartContainer config={lagChartConfig} className="h-64 w-full">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${v}d`}
            className="fill-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-sm">
                  <p className="font-medium">{d.date}</p>
                  <p className="text-muted-foreground">
                    Avg{" "}
                    <span
                      className="font-semibold"
                      style={{ color: lagColor(d.avgLag) }}
                    >
                      {d.avgLag}d
                    </span>{" "}
                    across {d.patients} patients
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine
            y={overallAvg}
            stroke="hsl(var(--foreground) / 0.4)"
            strokeDasharray="4 4"
            label={{
              value: `Overall Avg ${overallAvg}d`,
              position: "insideTopRight",
              fontSize: 11,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          <Bar dataKey="avgLag" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={lagColor(entry.avgLag)} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs?pageSize=200")
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

      <ChargeLagChart runs={completedRuns} />

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
