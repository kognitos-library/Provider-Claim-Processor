import { decodeArrowTable } from "./arrow";
import type {
  RawRun,
  RunState,
  RunSummary,
  RunDetail,
  PendingPatient,
  EmailStatus,
  ClaimField,
  ChargeLag,
} from "./types";
import { kognitosRunUrl } from "./kognitos";

function parseDate(raw: string): string {
  const num = Number(raw);
  if (!num || num < 1) return raw;

  // Excel serial dates are typically 5 digits (1-60000 range)
  if (num >= 1 && num <= 60000) {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + num);
    return epoch.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  }

  // Concatenated date: MDDYYYY or MMDDYYYY (e.g. "7251958" → 7/25/1958)
  const s = raw.padStart(8, "0");
  const month = s.length === 7 ? s.slice(0, 1) : s.slice(0, 2);
  const day = s.length === 7 ? s.slice(1, 3) : s.slice(2, 4);
  const year = s.slice(-4);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
    return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${year}`;
  }

  return raw;
}

function getRunState(run: RawRun): RunState {
  const s = run.state;
  if (s.completed) return "completed";
  if (s.awaiting_guidance) return "awaiting_guidance";
  if (s.failed) return "failed";
  if (s.executing) return "executing";
  if (s.stopped) return "stopped";
  return "pending";
}

function parsePatients(
  outputs: Record<string, unknown>
): PendingPatient[] {
  const tbl = outputs.pending_patients as
    | { table?: { inline?: { data?: string } } }
    | undefined;
  const b64 = tbl?.table?.inline?.data;
  if (!b64) return [];

  const rows = decodeArrowTable(b64);
  return rows.map((r) => ({
    patientName: String(r["Patient Name"] ?? ""),
    admissionDate: parseDate(String(r["Admission Date"] ?? "")),
    patientControlNumber: String(r["Patient Control Number"] ?? ""),
    insuredName: String(r["Insured Name"] ?? ""),
    dateOfBirth: parseDate(String(r["Date of Birth"] ?? "")),
    totalCharges: parseFloat(String(r["Total Charges"] ?? "0")) || 0,
    payer: String(r["Payer"] ?? ""),
  }));
}

function parseEmailStatuses(
  outputs: Record<string, unknown>
): EmailStatus[] {
  const tbl = outputs.email_status as
    | { table?: { inline?: { data?: string } } }
    | undefined;
  const b64 = tbl?.table?.inline?.data;
  if (!b64) return [];

  const rows = decodeArrowTable(b64);
  return rows.map((r) => ({
    recipientEmail: String(r["Recipient Email"] ?? ""),
    pdfFound: String(r["PDF Found"]).toLowerCase() === "true",
    patientName: String(r["Patient Name"] ?? ""),
    patientControlNumber: String(r["Patient Control Number"] ?? ""),
    emailSent: String(r["Email Sent"]).toLowerCase() === "true",
  }));
}

function parseClaimFields(
  outputs: Record<string, unknown>
): ClaimField[] {
  const tbl = outputs.claims_submitted as
    | { table?: { inline?: { data?: string } } }
    | undefined;
  const b64 = tbl?.table?.inline?.data;
  if (!b64) return [];

  const rows = decodeArrowTable(b64);
  return rows.map((r) => {
    const values: Record<string, string> = {};
    for (const [key, val] of Object.entries(r)) {
      if (key !== "Field" && key !== "Section") {
        values[key] = String(val ?? "");
      }
    }
    return {
      section: String(r["Section"] ?? ""),
      field: String(r["Field"] ?? ""),
      values,
    };
  });
}

function parseChargeLag(
  outputs: Record<string, unknown>
): ChargeLag[] {
  const tbl = outputs.charge_lag as
    | { table?: { inline?: { data?: string } } }
    | undefined;
  const b64 = tbl?.table?.inline?.data;
  if (!b64) return [];

  const rows = decodeArrowTable(b64);
  return rows
    .map((r) => ({
      patientName: String(r["Patient Name"] ?? ""),
      days: parseInt(String(r["Charge Lag"] ?? "0"), 10) || 0,
    }))
    .sort((a, b) => b.days - a.days);
}

function parsePdfUrls(
  outputs: Record<string, unknown>
): string[] {
  const list = outputs.completed_pdfs as
    | { list?: { items?: Array<{ file?: { remote?: string } }> } }
    | undefined;
  if (!list?.list?.items) return [];
  return list.list.items
    .map((item) => item.file?.remote ?? "")
    .filter(Boolean);
}

export function toRunSummary(run: RawRun): RunSummary {
  const id = run.name.split("/").pop()!;
  const state = getRunState(run);
  const outputs = (run.state.completed?.outputs ?? {}) as Record<
    string,
    unknown
  >;
  const patients = parsePatients(outputs);

  return {
    id,
    state,
    createdAt: run.create_time,
    patientCount: patients.length,
    totalCharges: patients.reduce((sum, p) => sum + p.totalCharges, 0),
    kognitosUrl: kognitosRunUrl(id),
    chargeLag: parseChargeLag(outputs),
  };
}

export function toRunDetail(run: RawRun): RunDetail {
  const summary = toRunSummary(run);
  const outputs = (run.state.completed?.outputs ?? {}) as Record<
    string,
    unknown
  >;

  return {
    ...summary,
    patients: parsePatients(outputs),
    emailStatuses: parseEmailStatuses(outputs),
    claimFields: parseClaimFields(outputs),
    pdfUrls: parsePdfUrls(outputs),
  };
}
