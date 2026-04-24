import { useCallback, useEffect, useState } from "react";

const healthCache = new Map<string, boolean>();

export function useServerHealth(url: string) {
  const [isHealthy, setIsHealthy] = useState<boolean | undefined>(undefined);

  const checkHealth = useCallback(async () => {
    if (healthCache.has(url)) {
      setIsHealthy(healthCache.get(url));
      return;
    }

    try {
      const response = await fetch(url, { method: "HEAD", mode: "no-cors" });
      const healthy = response.ok || response.type === "opaque";
      healthCache.set(url, healthy);
      setIsHealthy(healthy);
    } catch {
      healthCache.set(url, false);
      setIsHealthy(false);
    }
  }, [url]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return isHealthy;
}

export function useInViewHealth(url: string) {
  const [isInView, setIsInView] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 },
    );

    const element = document.querySelector(`[data-server-url="${url}"]`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [url]);

  useEffect(() => {
    if (isInView && isHealthy === undefined) {
      const checkHealth = async () => {
        if (healthCache.has(url)) {
          setIsHealthy(healthCache.get(url));
          return;
        }

        try {
          const response = await fetch(url, { method: "HEAD", mode: "no-cors" });
          const healthy = response.ok || response.type === "opaque";
          healthCache.set(url, healthy);
          setIsHealthy(healthy);
        } catch {
          healthCache.set(url, false);
          setIsHealthy(false);
        }
      };
      checkHealth();
    }
  }, [isInView, url]);

  return isHealthy;
}

export function clearHealthCache() {
  healthCache.clear();
}
