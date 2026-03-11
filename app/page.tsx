"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Title,
  Text,
  Skeleton,
  ChartContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Icon,
} from "@kognitos/lattice";
import {
  Bar,
  ComposedChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Dot,
  ReferenceLine,
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

function MetricCard({
  title,
  value,
  trend,
}: {
  title: string;
  value: string;
  trend?: { value: string; type: "positive" | "negative" };
}) {
  return (
    <div className="rounded-lg border bg-card min-w-[200px] p-5 flex flex-col gap-2">
      <span className="text-base font-medium text-muted-foreground truncate">
        {title}
      </span>
      {trend && (
        <span
          className={`text-xs font-medium ${
            trend.type === "positive" ? "text-success" : "text-destructive"
          }`}
        >
          {trend.value}
        </span>
      )}
      <span className="text-3xl font-medium leading-9 text-foreground">
        {value}
      </span>
    </div>
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function movingAvg(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });
}

const chargesChartConfig: TChartConfig = {
  totalCharges: {
    label: "Total Charges",
    color: "#10b981",
  },
  trend: {
    label: "5-Batch Avg",
    color: "#6366f1",
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

  const avgClaimLatest =
    latestBatch && latestBatch.patientCount > 0
      ? latestBatch.totalCharges / latestBatch.patientCount
      : null;
  const avgClaimPrev =
    prevBatch && prevBatch.patientCount > 0
      ? prevBatch.totalCharges / prevBatch.patientCount
      : null;
  const avgClaimTrend: "up" | "down" | "flat" =
    avgClaimLatest != null && avgClaimPrev != null
      ? avgClaimLatest > avgClaimPrev
        ? "up"
        : avgClaimLatest < avgClaimPrev
          ? "down"
          : "flat"
      : "flat";

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekBatches = runs.filter(
    (r) => now - new Date(r.createdAt).getTime() < weekMs
  ).length;
  const prevWeekBatches = runs.filter((r) => {
    const age = now - new Date(r.createdAt).getTime();
    return age >= weekMs && age < weekMs * 2;
  }).length;
  const batchTrend =
    prevWeekBatches > 0
      ? Math.round(
          ((thisWeekBatches - prevWeekBatches) / prevWeekBatches) * 100
        )
      : thisWeekBatches > 0
        ? 100
        : null;

  const totalCorrected = completedRuns.reduce(
    (s, r) => s + r.correctedCount,
    0
  );

  const chargesRuns = completedRuns
    .filter((r) => r.totalCharges > 0)
    .reverse();
  const chargesValues = chargesRuns.map((r) => r.totalCharges);
  const ma = movingAvg(chargesValues, 5);
  const avgCharge =
    chargesValues.length > 0
      ? Math.round(
          chargesValues.reduce((a, b) => a + b, 0) / chargesValues.length
        )
      : 0;
  const highBatchIdx = chargesValues.indexOf(Math.max(...chargesValues));
  const lowBatchIdx = chargesValues.indexOf(Math.min(...chargesValues));

  const chartData = chargesRuns.map((r, i) => ({
    name: formatShortDate(r.createdAt),
    totalCharges: r.totalCharges,
    trend: ma[i],
    patients: r.patientCount,
    perPatient:
      r.patientCount > 0
        ? Math.round(r.totalCharges / r.patientCount)
        : 0,
    date: formatDate(r.createdAt),
    isHigh: i === highBatchIdx,
    isLow: i === lowBatchIdx,
  }));

  const chargesTrending = (() => {
    if (chartData.length < 2) return "flat" as const;
    const recent5 = chargesValues.slice(-5);
    const prev5 = chargesValues.slice(-10, -5);
    if (prev5.length === 0) return "flat" as const;
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    const prevAvg = prev5.reduce((a, b) => a + b, 0) / prev5.length;
    const delta = (recentAvg - prevAvg) / prevAvg;
    if (delta > 0.05) return "up" as const;
    if (delta < -0.05) return "down" as const;
    return "flat" as const;
  })();
  const chargesTrendPct = (() => {
    if (chartData.length < 6) return 0;
    const recent5 = chargesValues.slice(-5);
    const prev5 = chargesValues.slice(-10, -5);
    if (prev5.length === 0) return 0;
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    const prevAvg = prev5.reduce((a, b) => a + b, 0) / prev5.length;
    return Math.round(Math.abs((recentAvg - prevAvg) / prevAvg) * 100);
  })();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
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

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Claim Batches Processed"
          value={String(runs.length)}
          trend={
            batchTrend !== null
              ? {
                  value: `${batchTrend >= 0 ? "+" : ""}${batchTrend}% vs prev week`,
                  type: batchTrend >= 0 ? "positive" : "negative",
                }
              : undefined
          }
        />
        <MetricCard
          title="Total Claims Submitted"
          value={totalPatients.toLocaleString()}
          trend={
            claimsTrend !== null
              ? {
                  value: `${claimsTrend >= 0 ? "+" : ""}${claimsTrend}% vs prev batch`,
                  type: claimsTrend >= 0 ? "positive" : "negative",
                }
              : undefined
          }
        />
        <div className="rounded-lg border bg-card min-w-[200px] p-5 flex flex-col gap-2">
          <span className="text-base font-medium text-muted-foreground truncate">
            Total Charges
          </span>
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            Average Claim:{" "}
            {totalPatients > 0 ? (
              <>
                {formatCurrency(totalCharges / totalPatients)}
                <span
                  className={`inline-block text-xs font-medium ${
                    avgClaimTrend === "up"
                      ? "text-success"
                      : avgClaimTrend === "down"
                        ? "text-destructive"
                        : "text-success"
                  }`}
                  aria-hidden
                >
                  {avgClaimTrend === "up" ? "↑" : avgClaimTrend === "down" ? "↓" : "→"}
                </span>
              </>
            ) : (
              "—"
            )}
          </span>
          <span className="text-3xl font-medium leading-9 text-foreground">
            {formatCurrency(totalCharges)}
          </span>
        </div>
        <div className="rounded-lg border bg-card min-w-[200px] p-5 flex flex-col gap-2">
          <span className="text-base font-medium text-muted-foreground truncate">
            Pre-Submission Issues Resolved
          </span>
          {totalPatients > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {totalCorrected.toLocaleString()} of {totalPatients.toLocaleString()} claims
            </span>
          )}
          <span
            className={`text-3xl font-medium leading-9 ${
              totalPatients > 0 && totalCorrected > 0
                ? "text-success"
                : "text-foreground"
            }`}
          >
            {totalCorrected.toLocaleString()} / {totalPatients.toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg border bg-card min-w-[200px] p-5 flex flex-col gap-2">
          <span className="text-base font-medium text-muted-foreground truncate">
            Touchless Submission Rate
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            Claims submitted without human intervention
          </span>
          <span className="text-3xl font-medium leading-9 text-success">
            97%
          </span>
        </div>
      </div>

      <ChargeLagChart runs={completedRuns} />

      {chartData.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Title level="h4">Charges by Batch</Title>
              <Text level="small" color="muted">
                Batch charges with 5-batch moving average
              </Text>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#10b981]/70" />
                Charges
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-0.5 bg-[#6366f1] rounded" />
                Trend
              </div>
              {chargesTrending !== "flat" && (
                <div
                  className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    color:
                      chargesTrending === "up" ? "#22c55e" : "#ef4444",
                    backgroundColor:
                      chargesTrending === "up"
                        ? "#22c55e14"
                        : "#ef444414",
                  }}
                >
                  <span className="text-sm leading-none">
                    {chargesTrending === "up" ? "↑" : "↓"}
                  </span>
                  {chargesTrendPct}%
                </div>
              )}
            </div>
          </div>
          <ChartContainer config={chargesChartConfig} className="h-72 w-full">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient
                  id="chargesGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                className="fill-muted-foreground"
              />
              <ReferenceLine
                y={avgCharge}
                stroke="hsl(var(--foreground) / 0.15)"
                strokeDasharray="4 4"
                label={{
                  value: `Avg ${formatCurrency(avgCharge)}`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--foreground) / 0.08)",
                  strokeWidth: 1,
                }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as (typeof chartData)[number];
                  const vsAvg = avgCharge
                    ? Math.round(
                        ((d.totalCharges - avgCharge) / avgCharge) * 100
                      )
                    : 0;
                  return (
                    <div className="rounded-lg border bg-popover px-4 py-3 shadow-lg text-sm min-w-[180px]">
                      <p className="font-medium mb-2">{d.date}</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Total
                          </span>
                          <span className="font-semibold text-[#10b981]">
                            {formatCurrency(d.totalCharges)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Patients
                          </span>
                          <span className="font-medium">{d.patients}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            Per patient
                          </span>
                          <span className="font-medium">
                            {formatCurrency(d.perPatient)}
                          </span>
                        </div>
                        <div className="border-t pt-1.5 flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            vs avg
                          </span>
                          <span
                            className={`font-semibold ${vsAvg >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {vsAvg >= 0 ? "+" : ""}
                            {vsAvg}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="totalCharges"
                fill="url(#chargesGradient)"
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                strokeDasharray=""
              />
            </ComposedChart>
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
