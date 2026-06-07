import { useState, useEffect, useCallback } from "react";
import {
  searchDownload,
  enqueueDownload,
  fetchDownloadQueue,
  deleteDownloadJob,
} from "../services/api.js";

const STATUS_COLORS = {
  pending: "bg-yellow-700 text-yellow-100",
  downloading: "bg-blue-700 text-blue-100",
  done: "bg-green-700 text-green-100",
  error: "bg-red-700 text-red-100",
};

const formatDuration = (s) => {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const QueueProgress = ({ queue }) => {
  const done = queue.filter((j) => j.status === "done").length;
  const active = queue.filter((j) =>
    ["pending", "downloading"].includes(j.status)
  ).length;

  if (active > 0) {
    return (
      <span className="text-xs text-spotify-lightgray">
        <span className="animate-spin rounded-full h-2 w-2 border-t-2 border-spotify-green inline-block mr-1.5 align-middle" />
        {done} / {queue.length} done
      </span>
    );
  }
  if (done === queue.length && done > 0) {
    return <span className="text-xs text-spotify-green">✓ {done} done</span>;
  }
  return null;
};

export default function DownloadPanel({ onClose, onDownloadComplete }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [queue, setQueue] = useState([]);

  const refreshQueue = useCallback(async () => {
    try {
      const jobs = await fetchDownloadQueue();
      setQueue((prev) => {
        const prevDoneIds = new Set(
          prev.filter((j) => j.status === "done").map((j) => j.id),
        );
        const newlyDone = jobs.some(
          (j) => j.status === "done" && !prevDoneIds.has(j.id),
        );
        if (newlyDone && onDownloadComplete) onDownloadComplete();
        return jobs;
      });
    } catch (_) {}
  }, [onDownloadComplete]);

  // Poll queue every 3 seconds while the panel is open
  useEffect(() => {
    refreshQueue();
    const id = setInterval(refreshQueue, 3000);
    return () => clearInterval(id);
  }, [refreshQueue]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const data = await searchDownload(query);
      setResults(data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  }

  async function handleEnqueue(item) {
    try {
      await enqueueDownload(item.url, {
        title: item.title,
        artist: item.uploader,
      });
      await refreshQueue();
    } catch (err) {
      console.error("Enqueue failed:", err);
    }
  }

  async function handleDelete(jobId) {
    try {
      await deleteDownloadJob(jobId);
      setQueue((prev) => prev.filter((j) => j.id !== jobId));
    } catch (_) {}
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl sonic-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-spotify-gray/80">
          <h2 className="text-white font-heading font-semibold tracking-tight">
            Download Music
          </h2>
          <button
            onClick={onClose}
            className="text-spotify-lightgray hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a song or paste a URL…"
              className="flex-1 bg-spotify-gray/85 text-white text-sm rounded-xl border border-spotify-gray/90 px-3 py-2 outline-none focus:border-spotify-green"
            />
            <button
              type="submit"
              disabled={searching}
              className="sonic-primary hover:brightness-110 disabled:opacity-50 text-sm font-bold px-4 py-2 rounded-xl transition"
            >
              {searching ? "…" : "Search"}
            </button>
          </form>

          {/* Search results */}
          {results.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-spotify-lightgray uppercase tracking-wider">
                Results
              </p>
              {results.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-spotify-gray/75 rounded-xl p-3 hover:bg-spotify-gray transition-colors border border-spotify-gray/70"
                >
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {item.title}
                    </p>
                    <p className="text-spotify-lightgray text-xs truncate">
                      {item.uploader}{" "}
                      {item.duration
                        ? `• ${formatDuration(item.duration)}`
                        : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEnqueue(item)}
                    className="shrink-0 sonic-primary hover:brightness-110 text-xs font-bold px-3 py-1.5 rounded-pill transition"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Download queue */}
          {queue.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-spotify-lightgray uppercase tracking-wider">
                  Queue
                </p>
                <QueueProgress queue={queue} />
              </div>
              {queue.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 bg-spotify-gray/75 rounded-xl p-3 border border-spotify-gray/70"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {job.title || job.url}
                    </p>
                    {job.artist && (
                      <p className="text-spotify-lightgray text-xs truncate">
                        {job.artist}
                      </p>
                    )}
                    {job.error && (
                      <p className="text-red-400 text-xs truncate">
                        {job.error}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status] ?? "bg-spotify-gray text-white"}`}
                  >
                    {job.status}
                  </span>
                  {["done", "error"].includes(job.status) && (
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-spotify-lightgray hover:text-white text-sm ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
