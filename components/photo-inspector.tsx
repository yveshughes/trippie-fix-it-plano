"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ScanSearch, X } from "lucide-react";
import type { Observation } from "@/lib/data";

type Props = { item: Observation; initialView: "original" | "sam"; onClose: () => void };
export default function PhotoInspector({ item, initialView, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [view, setView] = useState(initialView);
  const [zoom, setZoom] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = view === "sam" && item.samImage ? item.samImage : item.image;
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    const node = image.current!;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, []);
  const inspect = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !loaded) return;
    const bounds = image.current!.getBoundingClientRect();
    setPoint({ x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) });
  };
  const switchView = (next: "original" | "sam") => { if (next !== view) { setLoaded(false); setFailed(false); setView(next); } };
  const lens = Math.min(190, size.width, size.height);
  const x = (point?.x || 0) * size.width, y = (point?.y || 0) * size.height;
  return <dialog className="photo-inspector" ref={dialog} aria-labelledby="photo-inspector-title" aria-describedby="photo-inspector-help" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
    <div className="photo-inspector-panel">
      <header className="photo-inspector-header"><div><p>Photo inspection</p><h2 id="photo-inspector-title">{item.title}</h2></div><button className="photo-inspector-close" aria-label="Close photo inspection" autoFocus onClick={() => dialog.current?.close()}><X size={20}/></button></header>
      <div className="photo-inspector-toolbar">
        <div className="photo-view-switch" role="group" aria-label="Photo view"><button aria-pressed={view === "original"} onClick={() => switchView("original")}>Original</button>{item.samImage && <button aria-pressed={view === "sam"} onClick={() => switchView("sam")}>SAM highlight</button>}</div>
        <div className="photo-zoom-controls"><button className="photo-lens-toggle" aria-pressed={enabled} onClick={() => setEnabled(!enabled)}><ScanSearch size={15}/>Magnifier</button><label>Zoom <input aria-label="Magnification" type="range" min="2" max="5" step="1" value={zoom} onChange={e => setZoom(Number(e.target.value))}/><output>{zoom}×</output></label></div>
      </div>
      <div className="photo-inspector-canvas">
        <div className={`photo-inspector-stage ${enabled ? "lens-enabled" : ""}`} tabIndex={0} role="group" aria-label="Inspection image. Move pointer, drag, or use arrow keys to inspect." onPointerMove={inspect} onPointerDown={inspect} onPointerLeave={e => { if (e.pointerType === "mouse") setPoint(null); }} onKeyDown={e => {
          if (!enabled || !loaded || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          setPoint(p => ({ x: Math.max(0, Math.min(1, (p?.x ?? .5) + (e.key === "ArrowRight" ? .025 : e.key === "ArrowLeft" ? -.025 : 0))), y: Math.max(0, Math.min(1, (p?.y ?? .5) + (e.key === "ArrowDown" ? .025 : e.key === "ArrowUp" ? -.025 : 0))) }));
        }}>
          <img ref={image} src={source} alt={`${view === "sam" ? "SAM highlight" : "Original"}: ${item.title}`} draggable={false} onLoad={() => { setLoaded(true); setFailed(false); const node = image.current!; setSize({ width: node.clientWidth, height: node.clientHeight }); }} onError={() => { setLoaded(false); setFailed(true); }}/>
          {enabled && loaded && point && lens > 0 && <div className="photo-magnifier" aria-hidden="true" style={{ width: lens, height: lens, left: Math.max(0, Math.min(size.width - lens, x - lens / 2)), top: Math.max(0, Math.min(size.height - lens, y - lens / 2)), backgroundImage: `url(${JSON.stringify(source)})`, backgroundSize: `${size.width * zoom}px ${size.height * zoom}px`, backgroundPosition: `${lens / 2 - x * zoom}px ${lens / 2 - y * zoom}px` }}><span/></div>}
        </div>
        {failed && <p className="photo-inspector-error" role="alert">This photo could not be loaded. Close and reopen it to try again.</p>}
      </div>
      {item.analysisState === "complete" && <div className="photo-analysis-note"><strong>Muse Spark Open</strong><p>{item.interpretation}</p>{item.uncertainties?.length ? <p>{item.uncertainties.join(" ")}</p> : null}</div>}
      <p id="photo-inspector-help" className="photo-inspector-help">Move over the photo or drag to magnify. Arrow keys move the lens. Press Esc to close.</p>
    </div>
  </dialog>;
}
