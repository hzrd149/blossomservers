import { HardDrive } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export function ServerFavicon({ url, className }: { url: string; className?: string }) {
  const src = useMemo(() => new URL("/favicon.ico", url).toString(), [url]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return <HardDrive className={cn("h-5 w-5 shrink-0 text-muted-foreground", className)} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0 rounded-sm object-contain", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
