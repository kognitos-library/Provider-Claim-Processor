"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Title,
  Text,
  Badge,
  Skeleton,
  Icon,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@kognitos/lattice";
import type { RunDetail } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

export default function BatchDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load batch: ${r.status}`);
        return r.json();
      })
      .then(setRun)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/" className="text-sm text-link hover:underline flex items-center gap-1">
          <Icon type="ArrowLeft" size="sm" />
          Back to Dashboard
        </Link>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Batch not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const sections = new Map<string, typeof run.claimFields>();
  for (const field of run.claimFields) {
    const existing = sections.get(field.section) ?? [];
    existing.push(field);
    sections.set(field.section, existing);
  }

  const patientIds = Object.keys(
    run.claimFields.find((f) => Object.keys(f.values).length > 0)?.values ?? {}
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm text-link hover:underline flex items-center gap-1 mb-2"
          >
            <Icon type="ArrowLeft" size="sm" />
            Back to Dashboard
          </Link>
          <Title level="h2">Batch Detail</Title>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant={stateBadgeVariant(run.state)}>
              {stateLabel(run.state)}
            </Badge>
            <Text level="small" color="muted">
              {formatDate(run.createdAt)}
            </Text>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={run.kognitosUrl} target="_blank" rel="noopener noreferrer">
            <Icon type="ExternalLink" size="sm" />
            View in Kognitos
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <Text level="small" color="muted">Patients Processed</Text>
          <Title level="h3">{run.patientCount}</Title>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Text level="small" color="muted">Total Charges</Text>
          <Title level="h3">{formatCurrency(run.totalCharges)}</Title>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Text level="small" color="muted">Emails Sent</Text>
          <Title level="h3">
            {run.emailStatuses.filter((e) => e.emailSent).length} / {run.emailStatuses.length}
          </Title>
        </div>
      </div>

      {run.patients.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <Title level="h4">Patients</Title>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient Name</TableHead>
                <TableHead>Control Number</TableHead>
                <TableHead>Admission Date</TableHead>
                <TableHead>Date of Birth</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead className="text-right">Total Charges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.patients.map((p) => (
                <TableRow key={p.patientControlNumber}>
                  <TableCell className="font-medium">{p.patientName}</TableCell>
                  <TableCell>{p.patientControlNumber}</TableCell>
                  <TableCell>{p.admissionDate}</TableCell>
                  <TableCell>{p.dateOfBirth}</TableCell>
                  <TableCell>{p.payer}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(p.totalCharges)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {run.patients.length === 0 && run.state === "completed" && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <Icon type="FileText" size="xl" className="mx-auto mb-2 text-muted-foreground" />
          <Text level="base" color="muted">
            No patients to process in this batch
          </Text>
        </div>
      )}

      {run.emailStatuses.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <Title level="h4">Email Delivery Status</Title>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Control Number</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>PDF Found</TableHead>
                <TableHead>Email Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.emailStatuses.map((e) => (
                <TableRow key={e.patientControlNumber}>
                  <TableCell className="font-medium">{e.patientName}</TableCell>
                  <TableCell>{e.patientControlNumber}</TableCell>
                  <TableCell className="text-sm">{e.recipientEmail}</TableCell>
                  <TableCell>
                    <Badge variant={e.pdfFound ? "success" : "destructive"}>
                      {e.pdfFound ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.emailSent ? "success" : "destructive"}>
                      {e.emailSent ? "Sent" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {run.claimFields.length > 0 && patientIds.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <Title level="h4">CMS-1450 Claim Details</Title>
            <Text level="small" color="muted">
              {patientIds.length} patient{patientIds.length !== 1 ? "s" : ""} &middot;{" "}
              {run.claimFields.length} fields
            </Text>
          </div>
          <Accordion type="multiple" className="px-4">
            {Array.from(sections.entries()).map(([section, fields]) => (
              <AccordionItem key={section} value={section}>
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span>{section}</span>
                    <Badge variant="secondary">{fields.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Field</TableHead>
                          {patientIds.map((pid) => (
                            <TableHead key={pid} className="min-w-[180px]">
                              {pid}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((f) => (
                          <TableRow key={f.field}>
                            <TableCell className="font-medium text-sm">
                              {f.field}
                            </TableCell>
                            {patientIds.map((pid) => (
                              <TableCell key={pid} className="text-sm">
                                {f.values[pid] || "—"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
