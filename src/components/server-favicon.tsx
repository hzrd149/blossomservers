import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export function ServerFavicon({ url, className }: { url: URL; className?: string }) {
  const src = useMemo(() => new URL("/favicon.ico", url.origin).toString(), [url.origin]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
  }, [src]);

  if (hidden) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0 rounded-sm object-contain", className)}
      loading="lazy"
      onError={() => setHidden(true)}
    />
  );
}
