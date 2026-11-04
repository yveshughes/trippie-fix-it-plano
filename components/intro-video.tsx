"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Smartphone, X } from "lucide-react";

export default function IntroVideo({ phoneDemo = false }: { phoneDemo?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className={`watch-intro${phoneDemo ? " watch-phone-demo" : " watch-intro-preview"}`} aria-label={phoneDemo ? "App Demo" : undefined} title={phoneDemo ? "App Demo" : undefined} onClick={() => setOpen(true)}>{phoneDemo ? <><Smartphone size={18} aria-hidden="true"/>App Demo</> : <><span className="intro-nav-thumbnail"><img src="/videos/trippie-intro-thumbnail.jpg" alt="" width={64} height={36}/><Play size={14} fill="currentColor" aria-hidden="true"/></span>Watch Intro</>}</button>
    {open && <IntroDialog phoneDemo={phoneDemo} onClose={() => { setOpen(false); trigger.current?.focus(); }}/>}
  </>;
}

function IntroDialog({ onClose, phoneDemo }: { onClose: () => void; phoneDemo: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void video.current?.play().catch(() => {});
    return () => { video.current?.pause(); document.body.style.overflow = previous; };
  }, []);
  const retry = () => {
    const node = video.current;
    if (!node) return;
    setFailed(false);
    node.load();
    void node.play().catch(() => {});
  };
  return <dialog ref={dialog} className={`intro-modal${phoneDemo ? " phone-demo-modal" : ""}`} aria-labelledby={phoneDemo ? "phone-demo-title" : "intro-title"} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="intro-modal-panel">
      <header><div><p>A little robot. A safer neighborhood.</p><h2 id={phoneDemo ? "phone-demo-title" : "intro-title"}>{phoneDemo ? "Trippie in action" : "Meet Trippie"}</h2></div><button type="button" autoFocus aria-label={phoneDemo ? "Close phone demo" : "Close introduction"} onClick={() => dialog.current?.close()}><X size={20}/></button></header>
      <video ref={video} controls playsInline preload="metadata" poster={phoneDemo ? undefined : "/videos/trippie-intro-poster.jpg"} src={phoneDemo ? "/videos/trippie-android-demo-60s.mp4" : "/videos/trippie-intro-a2d32c6970b0.mp4"} onLoadedData={() => setFailed(false)} onPlaying={() => setFailed(false)} onError={() => setFailed(true)}>
        Your browser does not support video playback.
      </video>
      {failed && <div className="intro-video-error" role="alert"><span>Video playback was interrupted.</span><button type="button" onClick={retry}>Retry video</button></div>}
    </div>
  </dialog>;
}
