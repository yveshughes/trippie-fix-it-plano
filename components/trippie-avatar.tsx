"use client";
import { useEffect, useRef } from "react";

// A fresh document gets one trip; switching app pages keeps Trippie parked.
let introPlayed = false;

/** Decorative wordmark avatar; the adjacent brand name supplies its label. */
export default function TrippieAvatar() {
  const avatar = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = avatar.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || reducedMotion.matches || introPlayed) return;
    let animation: Animation | undefined;
    const park = () => {
      animation?.cancel();
      element.removeAttribute("style");
      element.classList.remove("avatar-on-patrol");
    };
    // Scheduling also lets React's development effect cleanup cancel its trial run.
    const frame = requestAnimationFrame(() => {
      if (introPlayed || reducedMotion.matches) return;
      introPlayed = true;
      // Use the unrotated layout dimensions to reserve the same logo footprint.
      const slot = element.parentElement!.getBoundingClientRect();
      const width = element.clientWidth;
      const height = element.clientHeight;
      const x = Math.max(0, document.documentElement.clientWidth - slot.left - width - 32);
      const y = Math.max(0, window.innerHeight - slot.top - height - 32);
      const heading = Math.atan2(y, x) * 180 / Math.PI + 90;
      const pose = (dx: number, dy: number, angle: number) => `translate(${dx}px, ${dy}px) rotate(${angle}deg)`;
      element.classList.add("avatar-on-patrol");
      Object.assign(element.style, { position: "fixed", left: `${slot.left}px`, top: `${slot.top}px`, width: `${width}px`, height: `${height}px`, margin: "0", zIndex: "1000", pointerEvents: "none" });
      animation = element.animate([
        { transform: pose(0, 0, -12), offset: 0, easing: "ease-in-out" },
        { transform: pose(0, 0, heading), offset: .1, easing: "cubic-bezier(.4,0,.2,1)" },
        { transform: pose(x, y, heading), offset: .45, easing: "ease-in-out" },
        { transform: pose(x, y, heading + 180), offset: .56, easing: "cubic-bezier(.4,0,.2,1)" },
        { transform: pose(0, 0, heading + 180), offset: .91, easing: "ease-in-out" },
        { transform: pose(0, 0, 348), offset: 1 },
      ], { duration: 4800, fill: "both" });
      animation.onfinish = park;
    });
    window.addEventListener("resize", park);
    window.addEventListener("scroll", park, { passive: true });
    reducedMotion.addEventListener("change", park);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", park);
      window.removeEventListener("scroll", park);
      reducedMotion.removeEventListener("change", park);
      park();
    };
  }, []);
  return (
    <span className="avatar-slot" aria-hidden="true">
    <svg
      ref={avatar}
      className="trippie-avatar"
      viewBox="0 0 96 110"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="brand-chassis"
          x1="28"
          y1="21"
          x2="68"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#71877b" />
          <stop offset="1" stopColor="#2d4637" />
        </linearGradient>
      </defs>
      <ellipse
        className="avatar-shadow"
        cx="48"
        cy="99"
        rx="32"
        ry="6"
        fill="#263c2c"
        opacity=".13"
      />
      <g className="avatar-drive">
        {[
          [9, 29],
          [68, 29],
          [9, 65],
          [68, 65],
        ].map(([x, y], index) => (
          <g key={index}>
            <rect
              x={x}
              y={y}
              width="19"
              height="29"
              rx="6"
              fill="#24352d"
              stroke="#192a22"
              strokeWidth="2"
            />
            <path
              className="avatar-tread"
              d={`M${x + 4} ${y + 3}v23 M${x + 10} ${y + 3}v23 M${x + 15} ${y + 3}v23`}
              stroke="#8d9c7d"
              strokeWidth="2"
              strokeDasharray="3 5"
              opacity=".55"
            />
          </g>
        ))}
        <g className="avatar-chassis">
          <path
            d="M30 22Q48 15 66 22L73 83Q48 99 23 83Z"
            fill="url(#brand-chassis)"
            stroke="#21392b"
            strokeWidth="2"
          />
          <path
            d="M33 26Q48 21 63 26"
            stroke="#b8c9ad"
            strokeWidth="2"
            opacity=".5"
          />
          <rect x="33" y="57" width="30" height="19" rx="4" fill="#192e24" />
          <path
            d="M38 62h20"
            stroke="#5b7960"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="48" cy="41" r="14" fill="#a1af8c" stroke="#768c6b" />
          <path d="M48 31l-6 8h4v8h4v-8h4z" fill="#f2c161" />
          <rect x="43" y="3" width="10" height="23" rx="4" fill="#23392b" />
          <circle
            className="avatar-sensor"
            cx="48"
            cy="10"
            r="2.5"
            fill="#d4ef9c"
          />
          <path
            d="M31 83h9m16 0h9"
            stroke="#d4ef9c"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
    </span>
  );
}
