export const publicWorkflowStatuses = ["Submitted", "Received", "In Progress", "Completed"] as const;
export type PublicWorkflowStatus = (typeof publicWorkflowStatuses)[number];
export type Observation = {
  id: string;
  mode?: "live" | "demo";
  trippieId?: string;
  capturedAt?: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  lat: number;
  lng: number;
  time: string;
  image: string;
  interpretation: string;
  status: "Needs review" | "Ready to report" | "Receipt recorded" | PublicWorkflowStatus;
  receipt?: string;
  samImage?: string;
  caseText?: string;
  submission?: { requestType: string; address: string; description: string; photo: string };
  sample: boolean;
  caseId?: string;
  caseRepresentative?: boolean;
  groupingReason?: string;
  caseResponseId?: string;
  caseEvidence?: { id: string; image: string; samImage?: string }[];
  decision?: "prepare_case" | "follow_up" | "no_issue" | "phone_escalation" | "routing_review";
  locationLabel?: string;
  locationMethod?: string;
  locationDistanceMeters?: number;
  locationConfidence?: "estimated";
  cityForm?: string;
  missingFields?: string[];
  observedFacts?: string[];
  uncertainties?: string[];
  sourceFile?: string;
  gpsAccuracyMeters?: number | null;
  modelInfo?: { model: string; provider: string; responseId: string; requestId: string | null; analyzedAt: string; estimatedCostUsd: number };

};
export const seed: Observation[] = [
  {
    id: "TRP-024",
    title: "Uneven sidewalk joint",
    category: "Sidewalk",
    priority: "High",
    lat: 33.0197,
    lng: -96.7011,
    time: "10:42 AM",
    image: "/sidewalk.svg",
    interpretation:
      "The leading edge of this sidewalk slab appears raised relative to the adjacent surface. This may present a trip hazard, particularly for people using mobility aids. A second view and physical measurement are needed to confirm the height difference.",
    status: "Needs review",
    sample: true,
  },
  {
    id: "TRP-023",
    title: "Debris in walking path",
    category: "Obstruction",
    priority: "Medium",
    lat: 33.0205,
    lng: -96.703,
    time: "10:38 AM",
    image: "/sidewalk.svg",
    interpretation:
      "Loose material appears to narrow the pedestrian path. Confirm whether a clear accessible route remains before reporting.",
    status: "Ready to report",
    sample: true,
  },
  {
    id: "TRP-022",
    title: "Surface crack",
    category: "Sidewalk",
    priority: "Low",
    lat: 33.0212,
    lng: -96.7042,
    time: "10:34 AM",
    image: "/sidewalk.svg",
    interpretation:
      "A visible surface joint or crack warrants observation. This image alone does not establish a significant level change or an urgent hazard.",
    status: "Needs review",
    sample: true,
  },
];
export const route: [number, number][] = [
  [33.0218, -96.705],
  [33.0212, -96.7042],
  [33.0205, -96.703],
  [33.0197, -96.7011],
  [33.0191, -96.7001],
];
