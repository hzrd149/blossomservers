import { castUser } from "applesauce-common/casts";
import { use$ } from "applesauce-react/hooks";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { eventStore } from "@/services/nostr";

export default function UserName({
  pubkey,
  className,
  link = true,
}: {
  pubkey: string;
  className?: string;
  link?: boolean;
}) {
  const user = useMemo(() => castUser(pubkey, eventStore), [pubkey]);
  const profile = use$(user.profile$);
  const name = profile?.displayName || user.npub.slice(0, 12) + "…";

  if (!link) return <span className={cn("truncate font-medium", className)}>{name}</span>;

  return (
    <Link to={`/user/${user.npub}`} className={cn("truncate font-medium hover:underline", className)}>
      {name}
    </Link>
  );
}
