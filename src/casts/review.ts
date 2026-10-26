import { Comment, Reaction } from "applesauce-common/casts";
import { CastRefEventStore, EventCast } from "applesauce-common/casts/cast";
import { CommentsModel, ReactionsModel } from "applesauce-common/models";
import { castTimelineStream } from "applesauce-common/observable";
import { getOrComputeCachedValue } from "applesauce-core/helpers/cache";
import { getTagValue, KnownEvent, NostrEvent } from "applesauce-core/helpers/event";

import { SERVER_REVIEW_KIND } from "../const";
import { getServerHost, safeNormalizeServerUrl } from "../helpers/server";

type ReviewEvent = KnownEvent<typeof SERVER_REVIEW_KIND>;

const ReviewUrlSymbol = Symbol.for("blossom-review-url");
const ReviewRatingSymbol = Symbol.for("blossom-review-rating");

/** Returns the normalized server URL a review is for */
export function getReviewServerUrl(event: NostrEvent): string | null {
  return getOrComputeCachedValue(event, ReviewUrlSymbol, () => safeNormalizeServerUrl(getTagValue(event, "d")));
}

/** Returns the overall NIP-85 rating of a review, a number between 0 and 1 */
export function getReviewRating(event: NostrEvent): number | null {
  return getOrComputeCachedValue(event, ReviewRatingSymbol, () => {
    const tag = event.tags.find((t) => t[0] === "rating" && t[1] && !t[2]);
    if (!tag) return null;

    const rating = parseFloat(tag[1]);
    if (!Number.isFinite(rating) || rating > 1 || rating < 0) return null;
    return rating;
  });
}

/** A kind 31963 server review */
export class ServerReview extends EventCast<ReviewEvent> {
  constructor(event: NostrEvent, store: CastRefEventStore) {
    if (event.kind !== SERVER_REVIEW_KIND || !getReviewServerUrl(event)) throw new Error("Invalid server review");
    super(event as ReviewEvent, store);
  }

  /** The normalized root URL of the reviewed server */
  get server() {
    return getReviewServerUrl(this.event)!;
  }
  get host() {
    return getServerHost(this.server);
  }
  /** The rating between 0 and 1, or null when the review has no rating */
  get rating() {
    return getReviewRating(this.event);
  }
  /** The rating out of five stars */
  get stars() {
    const rating = this.rating;
    return rating === null ? null : rating * 5;
  }
  get text() {
    return this.event.content;
  }

  /** NIP-25 reactions to this review */
  get reactions$() {
    return this.$$ref("reactions$", (store) =>
      store.model(ReactionsModel, this.event).pipe(castTimelineStream(Reaction, store)),
    );
  }
  /** Top level NIP-22 comments on this review */
  get comments$() {
    return this.$$ref("comments$", (store) =>
      store.model(CommentsModel, this.event).pipe(castTimelineStream(Comment, store)),
    );
  }
}
