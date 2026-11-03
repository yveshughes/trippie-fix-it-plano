import { publicWorkflowStatuses, type Observation } from "./data";
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("trippie", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("workspace");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export function validObservations(value: unknown): value is Observation[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (x) =>
        x &&
        ["id", "title", "category", "time", "image", "interpretation"].every(
          (k) => typeof x[k] === "string",
        ) &&
        (x.mode === undefined || ["live", "demo"].includes(x.mode)) &&
        ["High", "Medium", "Low"].includes(x.priority) &&
        ["Needs review", "Ready to report", "Receipt recorded", ...publicWorkflowStatuses].includes(
          x.status,
        ) &&
        typeof x.sample === "boolean" &&
        typeof x.lat === "number" &&
        Number.isFinite(x.lat) &&
        Math.abs(x.lat) <= 90 &&
        typeof x.lng === "number" &&
        Number.isFinite(x.lng) &&
        Math.abs(x.lng) <= 180 &&
        (x.trippieId === undefined || typeof x.trippieId === "string") &&
        (x.capturedAt === undefined || (typeof x.capturedAt === "string" && Number.isFinite(Date.parse(x.capturedAt)))) &&
        (x.receipt === undefined || typeof x.receipt === "string") &&
        (x.samImage === undefined || typeof x.samImage === "string") &&
        (x.submission === undefined || (x.submission && ["requestType", "address", "description", "photo"].every(k => typeof x.submission[k] === "string"))) &&
        (x.caseText === undefined || typeof x.caseText === "string") &&
        ["caseId", "groupingReason", "caseResponseId", "locationLabel", "locationMethod"].every(k => x[k] === undefined || typeof x[k] === "string") &&
        (x.caseRepresentative === undefined || typeof x.caseRepresentative === "boolean") &&
        (x.caseEvidence === undefined || (Array.isArray(x.caseEvidence) && x.caseEvidence.every((v: {id?: unknown; image?: unknown; samImage?: unknown}) => v && typeof v.id === "string" && typeof v.image === "string" && (v.samImage === undefined || typeof v.samImage === "string")))) &&
        (x.decision === undefined || ["prepare_case", "follow_up", "no_issue", "phone_escalation", "routing_review"].includes(x.decision)) &&
        (x.locationConfidence === undefined || x.locationConfidence === "estimated") &&
        (x.locationDistanceMeters === undefined || (Number.isFinite(x.locationDistanceMeters) && x.locationDistanceMeters >= 0)) &&
        (x.cityForm === undefined || typeof x.cityForm === "string") &&
        (x.sourceFile === undefined || typeof x.sourceFile === "string") &&
        (x.gpsAccuracyMeters === undefined || x.gpsAccuracyMeters === null || (typeof x.gpsAccuracyMeters === "number" && Number.isFinite(x.gpsAccuracyMeters) && x.gpsAccuracyMeters >= 0)) &&
        ["missingFields", "observedFacts", "uncertainties"].every(k => x[k] === undefined || (Array.isArray(x[k]) && x[k].every((v: unknown) => typeof v === "string"))) &&
        (x.modelInfo === undefined || (x.modelInfo && ["model", "provider", "responseId", "analyzedAt"].every(k => typeof x.modelInfo[k] === "string") && (x.modelInfo.requestId === null || typeof x.modelInfo.requestId === "string") && typeof x.modelInfo.estimatedCostUsd === "number" && Number.isFinite(x.modelInfo.estimatedCostUsd) && x.modelInfo.estimatedCostUsd >= 0)),
    )
  );
}
export async function loadObservations(): Promise<Observation[] | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("workspace")
      .objectStore("workspace")
      .get("observations");
    request.onsuccess = () =>
      resolve(validObservations(request.result) ? request.result : undefined);
    request.onerror = () => reject(request.error);
  });
}
export async function saveObservations(value: Observation[]) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(value, "observations");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
