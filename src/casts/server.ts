import { CastRefEventStore, EventCast } from "applesauce-common/casts/cast";
import { getOrComputeCachedValue } from "applesauce-core/helpers/cache";
import { getTagValue, KnownEvent, NostrEvent } from "applesauce-core/helpers/event";

import { SERVER_ADVERTIZEMENT_KIND } from "../const";
import { getServerHost, safeNormalizeServerUrl } from "../helpers/server";

type ServerEvent = KnownEvent<typeof SERVER_ADVERTIZEMENT_KIND>;

const ServerUrlSymbol = Symbol.for("blossom-server-url");

/** Returns the normalized server URL from the "d" tag of a server announcement */
export function getServerAnnouncementUrl(event: NostrEvent): string | null {
  return getOrComputeCachedValue(event, ServerUrlSymbol, () => safeNormalizeServerUrl(getTagValue(event, "d")));
}

/** Returns the value of an optional flag tag, true when the tag has no description */
function getFlag(event: NostrEvent, name: string): string | boolean {
  const tag = event.tags.find((t) => t[0] === name);
  if (!tag) return false;
  return tag[1] || true;
}

/** A kind 36363 Blossom server announcement */
export class ServerAnnouncement extends EventCast<ServerEvent> {
  constructor(event: NostrEvent, store: CastRefEventStore) {
    if (event.kind !== SERVER_ADVERTIZEMENT_KIND || !getServerAnnouncementUrl(event))
      throw new Error("Invalid server announcement");
    super(event as ServerEvent, store);
  }

  /** The normalized root URL of the server */
  get url() {
    return getServerAnnouncementUrl(this.event)!;
  }
  get host() {
    return getServerHost(this.url);
  }
  get name() {
    return getTagValue(this.event, "name") || this.host;
  }
  get description() {
    return this.event.content;
  }
  /** False, true, or a description of how payment works */
  get paid() {
    return getFlag(this.event, "paid");
  }
  /** False, true, or a description of who can upload */
  get whitelist() {
    return getFlag(this.event, "whitelist");
  }
}
