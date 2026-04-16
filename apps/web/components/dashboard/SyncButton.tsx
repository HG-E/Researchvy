"use client";
// components/dashboard/SyncButton.tsx
// Triggers data sync and polls for completion.

import { useState, useEffect } from "react";
import { sync } from "@/lib/api";
import type { SyncJob } from "@researchvy/shared";

interface Props {
  activeSync: SyncJob | null;
  onComplete?: () => void;
}

export function SyncButton({ activeSync: initialSync, onComplete }: Props) {
  const [job, setJob] = useState<SyncJob | null>(initialSync);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState("");

  // Poll every 3s while a sync is running
  useEffect(() => {
    if (!job || job.status === "COMPLETED" || job.status === "FAILED") return;

    const interval = setInterval(async () => {
      const res = await sync.status();
      if (!res.success) return;

      // The most recent job is first in the array
      const jobs = res.data as SyncJob[];
      const latest = jobs[0];
      if (!latest) return;

      setJob(latest);

      if (latest.status === "COMPLETED") {
        clearInterval(interval);
        onComplete?.();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job, onComplete]);

  async function handleSync() {
    setError("");
    setIsTriggering(true);

    const res = await sync.trigger("OPEN_ALEX");
    setIsTriggering(false);

    if (!res.success) {
      setError(res.error.message);
      return;
    }

    setJob((res.data as { job: SyncJob }).job);
  }

  const isRunning = job?.status === "PENDING" || job?.status === "RUNNING";
  const progress = job && job.itemsFound > 0
    ? Math.round((job.itemsProcessed / job.itemsFound) * 100)
    : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={isTriggering || isRunning}
        className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRunning ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {progress !== null ? `Syncing… ${progress}%` : "Syncing…"}
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync data
          </>
        )}
      </button>

      {job?.status === "COMPLETED" && (
        <p className="text-xs text-emerald-600">
          ✓ Synced {job.itemsProcessed} publications
        </p>
      )}

      {job?.status === "FAILED" && (
        <p className="text-xs text-red-500">Sync failed: {job.error}</p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
