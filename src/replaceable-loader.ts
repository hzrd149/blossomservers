import { ReplaceableLoader } from "applesauce-loaders/loaders";
import { eventStore, rxNostr } from "./core";
import { cacheRequest } from "./cache";

const replaceableLoader = new ReplaceableLoader(rxNostr, {
  cacheRequest,
  bufferTime: 500,
  lookupRelays: ["wss://purplepag.es/"],
});

// build loader pipeline
replaceableLoader.subscribe((packet) => {
  // add events
  eventStore.add(packet.event, packet.from);
});

export default replaceableLoader;
