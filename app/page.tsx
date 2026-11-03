"use client";
import dynamic from "next/dynamic";
import AppHeader from "@/components/app-header";
import PhotoInspector from "@/components/photo-inspector";
import InspectionSettings from "@/components/inspection-settings";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, MapPin, Search } from "lucide-react";
import { seed, publicWorkflowStatuses, type Observation } from "@/lib/data";
import { fleet } from "@/lib/fleet";
import { validObservations } from "@/lib/storage";
import { loadObservations } from "@/lib/storage";
const PatrolMap = dynamic(() => import("@/components/patrol-map"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading street map…</div>,
});
function Evidence({ item, highlight = false, onOpen }: { item: Observation; highlight?: boolean; onOpen: (item: Observation, view: "original" | "sam") => void }) {
  return <figure className="feed-evidence">
    <button type="button" className={`feed-photo photo-open ${!item.sample ? "field-photo" : ""}`} disabled={highlight && !item.samImage} aria-label={`Enlarge ${highlight ? "SAM highlight" : "original photo"}: ${item.title}`} onClick={() => onOpen(item, highlight ? "sam" : "original")}>
      <img src={highlight && item.samImage ? item.samImage : item.image} alt={`${highlight && item.samImage ? "SAM highlight" : "Original"}: ${item.title}`} />
      {highlight && item.sample && !item.samImage && <svg className="sam-overlay" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><path d="M70 400L420 376 922 411 918 463 420 425 58 452Z" fill="#c8ff592f" stroke="#ceff61" strokeWidth="6" strokeLinejoin="round" /></svg>}
      {highlight && !item.sample && !item.samImage && <span className="feed-no-mask">No SAM result attached</span>}
    </button>
    <figcaption>{highlight ? (item.sample ? "SAM · example outline" : "SAM highlight") : (item.sample ? "Original · sample illustration" : "Original capture")}</figcaption>
  </figure>;
}
function workflowStatus(item: Observation): string | null {
  return publicWorkflowStatuses.find(status => status === item.status) || (item.receipt ? null : "Draft");
}
export default function Home() {
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [revision, setRevision] = useState(0);
  const [photo, setPhoto] = useState<{ item: Observation; view: "original" | "sam" } | null>(null);
  const openPhoto = (item: Observation, view: "original" | "sam") => setPhoto({ item, view });
  const [items, setItems] = useState<Observation[]>(seed);
  const [robotId, setRobotId] = useState(fleet[0].id);
  const [remoteItems, setRemoteItems] = useState<Observation[]>([]);
  const [feedError, setFeedError] = useState(false);
  const [selected, setSelected] = useState(seed[0].id);
  const [tab, setTab] = useState("Overview");
  const [query, setQuery] = useState("");
  const [feedFilter, setFeedFilter] = useState("All cases");
  const [storageError, setStorageError] = useState("");
  const cards = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    const changed = (event: Event) => {
      const next = (event as CustomEvent).detail;
      if (next !== "live" && next !== "demo") return;
      setRemoteItems([]); setPhoto(null); setQuery(""); setFeedFilter("All cases");
      setMode(next); setRevision(value => value + 1);
    };
    window.addEventListener("trippie-workspace", changed);
    return () => window.removeEventListener("trippie-workspace", changed);
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "observations") setTab("Observations");
    if (requested === "cases") setTab("Cases");
    let cancelled = false;
    loadObservations().then(saved => { if (!cancelled && saved) setItems(saved); }).catch(() => { if (!cancelled) setStorageError("Browser storage is unavailable. Showing sample observations."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/patrols?mode=${mode}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Feed unavailable");
        const data: unknown = await response.json();
        if (!(Array.isArray(data) && (data.length === 0 || validObservations(data)))) throw new Error("Invalid feed");
        if (!cancelled) { setRemoteItems(data); setFeedError(false); }
      } catch { if (!cancelled) setFeedError(true); }
      finally { if (!cancelled) timer = setTimeout(refresh, 5000); }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [mode, revision]);
  const robot = fleet.find(x => x.id === robotId)!;
  const merged = new Map((mode === "live" ? items.filter(x => x.mode !== "demo") : []).map(x => [x.id, x]));
  remoteItems.filter(x => x.mode === mode).forEach(x => merged.set(x.id, x));
  const robotItems = Array.from(merged.values()).filter(x => (x.trippieId || "trippie-01") === robotId)
    .sort((a,b) => (Date.parse(b.capturedAt || "") || 0) - (Date.parse(a.capturedAt || "") || 0));
  useEffect(() => { if (robotItems.length && !robotItems.some(x => x.id === selected)) setSelected(robotItems[0].id); }, [robotId, robotItems[0]?.id, selected]);
  const mapCenter = useMemo<[number,number]>(() => robot.photoIntake && robotItems.length ? [robotItems[0].lat,robotItems[0].lng] : robot.center, [robot.photoIntake,robot.center,robotItems[0]?.lat,robotItems[0]?.lng]);
  const select = (id: string) => {
    setSelected(id);
    setFeedFilter("All cases");
    // Wait for a previously filtered card to mount before scrolling to it.
    const observation = robotItems.find(x => x.id === id);
    const representative = observation?.caseId ? robotItems.find(x => x.caseId === observation.caseId && x.caseRepresentative !== false) : undefined;
    requestAnimationFrame(() => cards.current.get(representative?.id || id)?.scrollIntoView({ block: "start", behavior: "instant" }));
  };
  const observations = robotItems.filter(x => `${x.title} ${x.id}`.toLowerCase().includes(query.toLowerCase()));
  const selectedCase = robotItems.find(x => x.id === selected)?.caseId;
  const feed = robotItems.filter(x => (feedFilter === "All cases" || workflowStatus(x) === feedFilter) && x.caseRepresentative !== false && (x.submission || x.decision === "prepare_case" || (!x.decision && x.status !== "Needs review") || x.receipt));
  return <div className="shell"><main>
    <AppHeader active={tab} observations={robotItems.length} cases={robotItems.filter(x => (x.caseRepresentative !== false && x.decision === "prepare_case") || (!x.decision && x.status !== "Needs review")).length} onTab={name => { setTab(name); setQuery(""); setFeedFilter("All cases"); }} />
    <section className="content">
      {storageError && <div className="storage-warning" role="alert">{storageError}</div>}
      <div className="work-grid feed-workspace">
        <section className="observation-column">
          <div className="trippie-picker"><label htmlFor="trippie-select">Following</label><select id="trippie-select" value={robotId} onChange={e => { const id=e.target.value; setRobotId(id); setQuery(""); setFeedFilter("All cases"); const first=Array.from(merged.values()).find(x => (x.trippieId || "trippie-01") === id); setSelected(first?.id || ""); }}>
            {fleet.map(x => <option key={x.id} value={x.id}>{x.name} · {x.neighborhood}</option>)}
          </select></div>
          <div className="queue-map"><PatrolMap observations={robotItems} selected={selected} onSelect={select} position={2} focus={0} patrolRoute={robot.route} center={mapCenter} neighborhood={robot.neighborhood} showRobot={!robot.photoIntake}/><span className="queue-map-label">{robot.neighborhood}</span></div>
          <div className="observation-stream-status" role="status"><i/>{feedError ? "Feed unavailable · showing last received observations" : mode === "demo" ? "DEMO · auto-refresh every 5 seconds" : robotItems.some(x => !x.sample) ? "Auto-refreshing · every 5 seconds" : "Auto-refreshing · every 5 seconds"}</div>
          <div className="observations observation-stream" aria-live="polite" aria-relevant="additions">
            <div className="list-heading"><h2>Observations <span>{observations.length}</span></h2></div>
            <div className="search"><Search size={15}/><input aria-label="Search observations" placeholder="Search observations…" value={query} onChange={e => setQuery(e.target.value)}/></div>
            {observations.map(x => <button className={`observation ${x.id === selected ? "selected" : ""}`} key={x.id} onClick={() => select(x.id)}>
              <img src={x.image} alt={x.sample ? "Sample illustration" : x.title}/><div><strong>{x.title}</strong><small>{x.id} · {x.time}{x.sample ? " · Sample" : ""}</small></div><span className={`priority ${x.priority.toLowerCase()}`}>{x.priority}</span><ChevronRight size={16}/>
            </button>)}
            {!observations.length && <p className="empty">{query ? "No observations match your search." : mode === "demo" ? "No demo observations yet." : "No observations yet."}</p>}
          </div>

        </section>
        <section className="case-feed" aria-label="Case feed">
          <div className="feed-heading"><div><h2>Case feed</h2><p>City service requests.</p></div><select aria-label="Filter case feed" value={feedFilter} onChange={e => setFeedFilter(e.target.value)}><option>All cases</option><option>Draft</option>{publicWorkflowStatuses.map(status => <option key={status}>{status}</option>)}</select></div>
          <div className="feed-scroll" tabIndex={0} aria-label="Scroll through cases">
            {feed.map(x => <article key={x.id} ref={node => { if (node) cards.current.set(x.id,node); else cards.current.delete(x.id); }} className={`feed-card ${x.id === selected || (x.caseId && x.caseId === selectedCase) ? "feed-selected" : ""}`}>
              <div className="case-post-meta"><p className="feed-request-type">{x.submission?.requestType || x.cityForm || x.category}</p><div className="case-post-labels"><span className={`priority ${x.priority.toLowerCase()}`} aria-label={`Risk level: ${x.priority}`}>{x.priority}</span>{workflowStatus(x) && <span className={`case-status-label ${workflowStatus(x)!.toLowerCase().replaceAll(" ", "-")}`}>{workflowStatus(x)}</span>}</div></div>
              <h2>{x.title}</h2>
              <p className="feed-location"><MapPin size={14}/>{x.submission?.address || x.locationLabel || (x.sample ? "Sample location" : `${x.lat.toFixed(5)}, ${x.lng.toFixed(5)}`)}</p>
              <div className="feed-photos"><Evidence item={x} onOpen={openPhoto}/><Evidence item={x} highlight onOpen={openPhoto}/></div>
              <div className="feed-description"><h3>Description</h3><p>{x.submission?.description || x.caseText || x.interpretation}</p></div>
            </article>)}
            {!feed.length && <div className="feed-empty"><h3>{feedFilter === "All cases" ? "No cases to show" : `No ${feedFilter.toLowerCase()} cases yet`}</h3><p>Cases will appear here as their status changes.</p></div>}
          </div>
        </section>
        <InspectionSettings/>
      </div>
    </section>
  </main>{photo && <PhotoInspector item={photo.item} initialView={photo.view} onClose={() => setPhoto(null)}/>}</div>;
}
