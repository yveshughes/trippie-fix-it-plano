"use client";
import { useEffect, useRef } from "react";
import type { Observation } from "@/lib/data";

export default function PatrolMap({
  observations,
  selected,
  onSelect,
  position,
  focus,
  patrolRoute,
  center,
  neighborhood,
  showRobot = true,
}: {
  observations: Observation[];
  selected: string;
  onSelect: (id: string) => void;
  position: number;
  focus: number;
  patrolRoute: [number, number][];
  center: [number, number];
  neighborhood: string;
  showRobot?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !host.current) return;
      const map = L.map(host.current, { zoomControl: false }).setView(
        center,
        16,
      );
      instance.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      if (patrolRoute.length) { L.polyline(patrolRoute, { color: "#344a38", weight: 6, opacity: 0.17 }).addTo(
        map,
      );
      L.polyline(patrolRoute, {
        color: "#52663d",
        weight: 3,
        dashArray: "7 9",
      }).addTo(map);
      }
      layer.current = L.layerGroup().addTo(map);
    });
    return () => {
      cancelled = true;
      instance.current?.remove();
      instance.current = null;
      layer.current = null;
    };
  }, [patrolRoute, center]);
  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      if (!layer.current) {
        timer = setTimeout(draw, 100);
        return;
      }
      layer.current.clearLayers();
      observations.forEach((o) => {
        if (o.lat === null || o.lng === null) return;
        L.marker([o.lat, o.lng], {
          icon: L.divIcon({
            className: "case-pin",
            html: `<span class="${o.id === selected ? "chosen" : ""}">${o.priority === "High" ? "!" : "·"}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        })
          .on("click", () => callback.current(o.id))
          .addTo(layer.current!);
      });
      if (showRobot && patrolRoute.length) L.marker(patrolRoute[position % patrolRoute.length], {
        icon: L.divIcon({
          className: "robot-pin",
          html: '<div><img src="/robot.svg" alt="Trippie robot"/></div>',
          iconSize: [76, 86],
          iconAnchor: [38, 55],
        }),
      }).addTo(layer.current);
    };
    let timer: ReturnType<typeof setTimeout>;
    draw();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [observations, selected, position, patrolRoute, center, showRobot]);
  useEffect(() => {
    if (patrolRoute.length) instance.current?.flyTo(patrolRoute[position % patrolRoute.length], 16, {
      duration: 0.5,
    });
  }, [focus, position, patrolRoute]);
  return (
    <div
      className="map"
      ref={host}
      aria-label={`Interactive street map of ${neighborhood}`}
    />
  );
}
