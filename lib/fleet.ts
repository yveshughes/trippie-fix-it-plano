import { route } from "./data";
export const fleet: { id: string; name: string; neighborhood: string; center: [number,number]; route: [number,number][]; photoIntake?: boolean }[] = [
  { id: "pixel-10", name: "Trippie · Pixel 10", neighborhood: "Field photos", center: [33.0204,-96.7023], route: [], photoIntake: true },
  { id: "trippie-01", name: "Trippie 01", neighborhood: "Downtown Plano", center: [33.0204, -96.7023] as [number, number], route },
  { id: "trippie-02", name: "Trippie 02", neighborhood: "Arbor Hills", center: [33.0462, -96.8517] as [number, number], route: route.map(([lat,lng]) => [lat + .0258, lng - .1494] as [number,number]) },
  { id: "trippie-03", name: "Trippie 03", neighborhood: "Oak Point", center: [33.0675, -96.6742] as [number, number], route: route.map(([lat,lng]) => [lat + .0471, lng + .0281] as [number,number]) },
];
