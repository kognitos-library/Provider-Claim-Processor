export type RunState =
  | "completed"
  | "awaiting_guidance"
  | "failed"
  | "executing"
  | "pending"
  | "stopped";

export interface RunOutput {
  table?: { inline?: { data?: string } };
  list?: { items?: Array<{ file?: { remote?: string } }> };
  string?: { text?: string } | string;
  number?: { lo?: number };
}

export interface RawRun {
  name: string;
  create_time: string;
  update_time?: string;
  state: {
    completed?: {
      outputs?: Record<string, RunOutput>;
      update_time?: string;
    };
    awaiting_guidance?: {
      exception?: string;
      description?: string;
    };
    failed?: {
      error?: string;
      description?: string;
    };
    executing?: Record<string, unknown>;
    pending?: Record<string, unknown>;
    stopped?: Record<string, unknown>;
    update_time?: string;
  };
  user_inputs?: Record<string, { text?: string }>;
  invocation_details?: {
    invocation_source?: string;
    user_id?: string;
  };
}

export interface PendingPatient {
  patientName: string;
  admissionDate: string;
  patientControlNumber: string;
  insuredName: string;
  dateOfBirth: string;
  totalCharges: number;
  payer: string;
}

export interface EmailStatus {
  recipientEmail: string;
  pdfFound: boolean;
  patientName: string;
  patientControlNumber: string;
  emailSent: boolean;
}

export interface ChargeLag {
  patientName: string;
  days: number;
}

export interface ClaimField {
  section: string;
  field: string;
  values: Record<string, string>;
}

export interface RunSummary {
  id: string;
  state: RunState;
  createdAt: string;
  patientCount: number;
  totalCharges: number;
  correctedCount: number;
  kognitosUrl: string;
  chargeLag: ChargeLag[];
}

export interface RunDetail extends RunSummary {
  patients: PendingPatient[];
  emailStatuses: EmailStatus[];
  claimFields: ClaimField[];
  pdfUrls: string[];
}
