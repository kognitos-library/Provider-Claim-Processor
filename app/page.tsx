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
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Dot,
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

  const first = data[0]?.avgLag ?? 0;
  const last = data[data.length - 1]?.avgLag ?? 0;
  const delta = last - first;
  const pctChange =
    first > 0 ? Math.round(Math.abs(delta / first) * 100) : 0;
  const trending = delta < -0.1 ? "down" : delta > 0.1 ? "up" : "flat";

  const trendColor =
    trending === "down" ? "#22c55e" : trending === "up" ? "#ef4444" : "#a3a3a3";
  const trendArrow = trending === "down" ? "↓" : trending === "up" ? "↑" : "→";
  const trendWord =
    trending === "down"
      ? "Decreasing"
      : trending === "up"
        ? "Increasing"
        : "Stable";
  const lineColor = "#6366f1";

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <Title level="h4">Charge Lag</Title>
          <Text level="small" color="muted">
            Average days from admission to charge submission
          </Text>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            color: trendColor,
            backgroundColor: `${trendColor}14`,
          }}
        >
          <span className="text-base leading-none">{trendArrow}</span>
          {trendWord}
          {pctChange > 0 && ` ${pctChange}%`}
        </div>
      </div>
      <ChartContainer config={lagChartConfig} className="h-64 w-full">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lagGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            className="stroke-border"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${v}d`}
            axisLine={false}
            tickLine={false}
            domain={[0, "auto"]}
            className="fill-muted-foreground"
          />
          <Tooltip
            cursor={{
              stroke: "hsl(var(--foreground) / 0.1)",
              strokeWidth: 1,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-popover px-3.5 py-2.5 shadow-lg text-sm">
                  <p className="font-medium mb-0.5">{d.date}</p>
                  <div className="flex items-baseline gap-1.5 text-muted-foreground">
                    <span
                      className="text-lg font-bold"
                      style={{ color: lineColor }}
                    >
                      {d.avgLag}d
                    </span>
                    <span>avg across {d.patients} patients</span>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="avgLag"
            stroke={lineColor}
            strokeWidth={2.5}
            fill="url(#lagGradient)"
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, index } = props as {
                cx: number;
                cy: number;
                index: number;
              };
              const isLast = index === data.length - 1;
              return (
                <Dot
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 5 : 3.5}
                  fill={isLast ? trendColor : "#fff"}
                  stroke={isLast ? trendColor : lineColor}
                  strokeWidth={isLast ? 0 : 2}
                />
              );
            }}
            activeDot={{
              r: 5,
              fill: lineColor,
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
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

  const latestBatch = completedRuns[0];
  const prevBatch = completedRuns[1];
  const claimsTrend =
    latestBatch && prevBatch && prevBatch.patientCount > 0
      ? Math.round(
          ((latestBatch.patientCount - prevBatch.patientCount) /
            prevBatch.patientCount) *
            100
        )
      : null;
  const chargeTrend =
    latestBatch && prevBatch && prevBatch.totalCharges > 0
      ? Math.round(
          ((latestBatch.totalCharges - prevBatch.totalCharges) /
            prevBatch.totalCharges) *
            100
        )
      : null;

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
          title="Claims Submitted"
          value={totalPatients.toLocaleString()}
          trend={
            claimsTrend !== null
              ? {
                  value: `${claimsTrend >= 0 ? "+" : ""}${claimsTrend}% vs prev`,
                  type: claimsTrend >= 0 ? "positive" : "negative",
                }
              : undefined
          }
        />
        <InsightsCard
          title="Total Charges"
          value={formatCurrency(totalCharges)}
          trend={
            chargeTrend !== null
              ? {
                  value: `${chargeTrend >= 0 ? "+" : ""}${chargeTrend}% vs prev`,
                  type: chargeTrend >= 0 ? "positive" : "negative",
                }
              : undefined
          }
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
