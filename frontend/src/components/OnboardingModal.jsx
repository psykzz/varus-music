import { useState, useEffect, useRef } from "react";
import { fetchGenres, seedForUser, refreshPlaylist } from "../services/api.js";
import { patchUser } from "../services/auth.js";

const GENRE_ICONS = {
  pop: "🎤",
  rock: "🎸",
  "hip-hop": "🎧",
  electronic: "🎛️",
  classical: "🎻",
  indie: "🌿",
  jazz: "🎷",
  "r&b": "🎹",
};

export default function OnboardingModal({ onComplete }) {
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [step, setStep] = useState("genres"); // genres | cadence
  const [cadence, setCadence] = useState("weekly");
  const [status, setStatus] = useState("idle"); // idle | seeding | done
  const pendingGenresRef = useRef([]);

  useEffect(() => {
    fetchGenres()
      .then((data) => setGenres(data.genres ?? []))
      .catch(() => {
        setGenres(["pop", "rock", "hip-hop", "electronic", "classical", "indie", "jazz", "r&b"]);
      });
  }, []);

  function toggleGenre(genre) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(genre) ? next.delete(genre) : next.add(genre);
      return next;
    });
  }

  function goToCadence(chosenGenres) {
    pendingGenresRef.current = chosenGenres;
    setStep("cadence");
  }

  async function handleStart(chosenGenres, chosenCadence) {
    setStatus("seeding");
    try {
      await seedForUser(chosenGenres, chosenCadence);
      patchUser({ onboardingComplete: true });
      localStorage.setItem("varus_building", "true");
      await refreshPlaylist();
    } catch (err) {
      console.error("[Onboarding] Seeding failed:", err);
      patchUser({ onboardingComplete: true });
      localStorage.setItem("varus_building", "true");
    }
    setStatus("done");
    onComplete();
  }

  if (status === "seeding") {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="sonic-surface rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-spotify-green mx-auto mb-6" />
          <h2 className="text-white text-xl font-heading font-bold mb-2 tracking-tight">
            Building your library…
          </h2>
          <p className="text-spotify-lightgray text-sm">
            We're queuing popular tracks for you. Music will appear as downloads complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="sonic-surface rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        {step === "cadence" ? (
          <>
            <div className="text-center mb-8">
              <span className="text-5xl block mb-4">📅</span>
              <h2 className="text-white text-2xl font-heading font-bold tracking-tight">
                How often do you want fresh music?
              </h2>
              <p className="text-spotify-lightgray mt-2 text-sm">
                We'll refresh your playlist on this schedule.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { value: "daily", label: "Daily", icon: "⚡" },
                { value: "weekly", label: "Weekly", icon: "🗓️" },
                { value: "monthly", label: "Monthly", icon: "🌙" },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setCadence(value)}
                  className={[
                    "flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 transition-all text-sm font-medium",
                    cadence === value
                      ? "border-spotify-green bg-cyan-400/10 text-spotify-green"
                      : "border-spotify-gray text-spotify-lightgray hover:border-spotify-lightgray hover:text-white",
                  ].join(" ")}
                  aria-pressed={cadence === value}
                >
                  <span className="text-2xl">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleStart(pendingGenresRef.current, cadence)}
                disabled={status !== "idle"}
                className="w-full py-3 sonic-primary font-bold rounded-pill hover:brightness-110 transition disabled:opacity-50"
              >
                Start Discovering
              </button>
              <button
                onClick={() => setStep("genres")}
                className="w-full py-2 text-spotify-lightgray hover:text-white text-sm transition-colors"
              >
                ← Back
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <span className="text-5xl block mb-4">🎵</span>
              <h2 className="text-white text-2xl font-heading font-bold tracking-tight">
                Welcome to Varus Music
              </h2>
              <p className="text-spotify-lightgray mt-2 text-sm">
                Pick a few genres you enjoy and we'll seed your library with popular tracks. Rate them to personalise your rotation over time.
              </p>
            </div>
            {genres.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {genres.map((genre) => {
                  const isSelected = selected.has(genre);
                  return (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={[
                        "flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 transition-all text-sm font-medium capitalize",
                        isSelected
                          ? "border-spotify-green bg-cyan-400/10 text-spotify-green"
                          : "border-spotify-gray text-spotify-lightgray hover:border-spotify-lightgray hover:text-white",
                      ].join(" ")}
                      aria-pressed={isSelected}
                    >
                      <span className="text-2xl">{GENRE_ICONS[genre] ?? "🎵"}</span>
                      {genre}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-center mb-8">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-spotify-green" />
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => goToCadence([...selected])}
                disabled={status !== "idle"}
                className="w-full py-3 sonic-primary font-bold rounded-pill hover:brightness-110 transition disabled:opacity-50"
              >
                {selected.size === 0
                  ? "Start Discovering"
                  : `Start with ${selected.size} genre${selected.size > 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => goToCadence([])}
                className="w-full py-2 text-spotify-lightgray hover:text-white text-sm transition-colors"
              >
                Skip — seed a bit of everything
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
