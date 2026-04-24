import { useEffect, useState, useCallback, useRef } from "react";

const HEALTH_CACHE_KEY = "server-health-cache";

interface HealthCacheEntry {
  healthy: boolean;
  timestamp: number;
}

function getHealthEntry(url: string): HealthCacheEntry | undefined {
  try {
    const stored = sessionStorage.getItem(`${HEALTH_CACHE_KEY}:${url}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return undefined;
}

function setHealthEntry(url: string, entry: HealthCacheEntry) {
  try {
    sessionStorage.setItem(`${HEALTH_CACHE_KEY}:${url}`, JSON.stringify(entry));
  } catch {}
}

export function ServerStatusDot({ url }: { url: string }) {
  const [isHealthy, setIsHealthy] = useState<boolean | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  const checkHealth = useCallback(async () => {
    const cached = getHealthEntry(url);
    if (cached) {
      setIsHealthy(cached.healthy);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);
      const healthy = response.ok;
      setHealthEntry(url, { healthy, timestamp: Date.now() });
      setIsHealthy(healthy);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TypeError) {
        setHealthEntry(url, { healthy: false, timestamp: Date.now() });
        setIsHealthy(false);
      }
    }
  }, [url]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          checkHealth();
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [checkHealth]);

  return (
    <div
      ref={ref}
      className={`w-2 h-2 rounded-full ${isHealthy === true ? "bg-green-500" : isHealthy === false ? "bg-red-500" : "bg-gray-300"}`}
    />
  );
}
