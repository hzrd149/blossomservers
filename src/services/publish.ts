import { ActionRunner } from "applesauce-actions";
import { castUser } from "applesauce-common/casts";
import { NostrEvent, relaySet } from "applesauce-core/helpers";
import { EventFactory } from "applesauce-core/factories";

import { DEFAULT_RELAYS } from "../const";
import { accounts } from "./accounts";
import { eventStore, pool } from "./nostr";

/** Thrown when no relay accepted a published event */
export class PublishError extends Error {}

/** Publishes an event to the default relays, any extra relays and the author's outboxes */
export async function publishEvent(event: NostrEvent, relays: string[] = []) {
  const outboxes = await castUser(event.pubkey, eventStore).outboxes$.$first(1500, [] as string[]);
  const targets = relaySet(relays, outboxes, DEFAULT_RELAYS);

  const responses = await pool.publish(targets, event);

  // Add the event to the store so the UI updates right away
  eventStore.add(event);

  if (!responses.some((response) => response.ok)) {
    const reason = responses.find((response) => response.message)?.message;
    throw new PublishError(reason ? `No relay accepted the event: ${reason}` : "No relay accepted the event");
  }

  return responses;
}

/** Signs an event with the active account and publishes it */
export async function signAndPublish(factory: EventFactory<any, any>) {
  if (!accounts.active) throw new Error("Sign in first");
  const signed = await factory.sign(accounts.signer);
  await publishEvent(signed);
  return signed;
}

/** Runs pre-built actions (comments, server lists) with the active account */
export const actions = new ActionRunner(eventStore, accounts.signer, (event, relays) => publishEvent(event, relays));
