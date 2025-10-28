import { getDisplayName, getProfilePicture } from "applesauce-core/helpers";
import { useObservableMemo } from "applesauce-react/hooks";

import { eventStore } from "../../nostr";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default function UserAvatar({ pubkey }: { pubkey: string }) {
  const profile = useObservableMemo(() => eventStore.profile(pubkey), [pubkey]);
  const name = getDisplayName(profile);

  return (
    <Avatar>
      <AvatarFallback>{name?.slice(0, 1) || "U"}</AvatarFallback>
      <AvatarImage src={getProfilePicture(profile)} alt={name} />
    </Avatar>
  );
}
