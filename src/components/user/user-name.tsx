import { useObservableMemo } from "applesauce-react/hooks";
import { getDisplayName } from "applesauce-core/helpers";

import { eventStore } from "../../nostr";

export default function UserName({ pubkey }: { pubkey: string }) {
  const profile = useObservableMemo(() => eventStore.profile(pubkey), [pubkey]);

  return <span>{getDisplayName(profile, pubkey.slice(0, 8))}</span>;
}
