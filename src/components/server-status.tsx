import { use$ } from "applesauce-react/hooks";
import { useState } from "react";

import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { serverHealth$ } from "@/services/health";

/** A status dot and latency for a server, checked once it scrolls into view */
export function ServerStatus({ url, showLabel = false, className }: { url: string; showLabel?: boolean; className?: string }) {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const inView = useInView(element);
  const health = use$(() => (inView ? serverHealth$(url) : undefined), [url, inView]);

  const state = health?.state ?? "checking";
  const label =
    health?.state === "online" ? `${health.latency}ms` : health?.state === "offline" ? "Unreachable" : "Checking";
  const title =
    health?.state === "online"
      ? `Online, responded with ${health.status} in ${health.latency}ms`
      : health?.state === "offline"
        ? health.error
        : "Checking server status";

  return (
    <span ref={setElement} className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)} title={title}>
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          state === "online" && "bg-green-500",
          state === "offline" && "bg-red-500",
          state === "checking" && "animate-pulse bg-gray-400",
        )}
      />
      {showLabel && <span className="tabular-nums">{label}</span>}
    </span>
  );
}
