"use client";
import { useEffect, useState } from "react";
import { Settings2, Check } from "lucide-react";
const groups = [
  {
    title: "Walking surfaces",
    items: [
      "Potholes and damaged pavement",
      "Cracked or raised sidewalk slabs",
      "Blocked sidewalks and curb ramps",
      "Missing or damaged drainage grates",
      "Standing water and drainage blockages",
    ],
  },
  {
    title: "Public spaces",
    items: [
      "Illegal dumping and accumulated litter",
      "Fallen branches and storm debris",
      "Vegetation obstructing pedestrian paths",
      "Damaged or obscured street signs",
      "Damaged public benches or trash bins",
      "Overflowing public trash bins",
      "Graffiti on public infrastructure",
    ],
  },
  {
    title: "Maintenance & follow-up",
    items: [
      "Damaged streetlights",
      "Streetlights out during nighttime patrols",
      "Dead animals on public property",
      "Suspected water leaks",
      "Recheck previously reported issues",
    ],
  },
];
const targets = groups.flatMap((g) => g.items);
const defaults = targets.slice(0, 3);
const key = "trippie-inspection-targets-v1";
export default function InspectionSettings() {
  const [enabled, setEnabled] = useState<string[]>(defaults),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (Array.isArray(value) && value.every((x) => typeof x === "string"))
          setEnabled(targets.filter((x) => value.includes(x)));
      }
    } catch {
      setError(true);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(enabled));
      setError(false);
    } catch {
      setError(true);
    }
  }, [enabled, loaded]);
  return (
    <aside className="inspection-settings" aria-label="Inspection settings">
      <div className="settings-heading">
        <span className="settings-icon">
          <Settings2 size={18} />
        </span>
        <div>
          <h2>Inspection settings</h2>
          <p>What should Trippie look for?</p>
        </div>
      </div>
      <div className="settings-tools">
        <span>{enabled.length} enabled</span>
        <button disabled={!loaded} onClick={() => setEnabled([...targets])}>
          Select all
        </button>
        <button disabled={!loaded} onClick={() => setEnabled([])}>
          Clear
        </button>
      </div>
      <div className="settings-options">
        {groups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.items.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  disabled={!loaded}
                  checked={enabled.includes(item)}
                  onChange={(e) =>
                    setEnabled((xs) =>
                      e.target.checked
                        ? [...xs, item]
                        : xs.filter((x) => x !== item),
                    )
                  }
                />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div
        className={`settings-save ${error ? "settings-error" : ""}`}
        role="status"
      >
        <Check size={13} />
        {error
          ? "Could not save settings in this browser."
          : "Saved in this browser"}
      </div>
    </aside>
  );
}
