import { blankEventTemplate, EventFactory, toEventTemplate } from "applesauce-core/factories";
import { KnownEvent } from "applesauce-core/helpers";
import { removeSingletonTag, setSingletonTag } from "applesauce-core/operations/tag/common";

import { SERVER_ADVERTIZEMENT_KIND, SERVER_REPORT_KIND, SERVER_REVIEW_KIND } from "./const";
import { parseReport, reportServerUrl, reportTags, ServerReportData } from "./helpers/report";
import { normalizeServerUrl } from "./helpers/server";

/** New reports are complete author/URL snapshots; legacy announcements stay read-only. */
export class ServerReportFactory extends EventFactory<typeof SERVER_REPORT_KIND> {
  static create(url: string, data: ServerReportData) {
    const canonical = reportServerUrl(url);
    if (!canonical) throw new Error("Enter a public HTTPS server URL");
    const template = {
      ...blankEventTemplate(SERVER_REPORT_KIND),
      created_at: Math.floor(Date.now() / 1000),
      tags: reportTags(canonical, data),
      content: JSON.stringify(data),
    };
    if (!parseReport(template)) throw new Error("Invalid report data");
    return new ServerReportFactory((res) => res(template));
  }
}

/** Builds kind 36363 Blossom server announcements */
export class ServerAnnouncementFactory extends EventFactory<typeof SERVER_ADVERTIZEMENT_KIND> {
  static create(url: string) {
    return new ServerAnnouncementFactory((res) => res(blankEventTemplate(SERVER_ADVERTIZEMENT_KIND))).url(url);
  }
  static modify(event: KnownEvent<typeof SERVER_ADVERTIZEMENT_KIND>) {
    return new ServerAnnouncementFactory((res) => res(toEventTemplate(event)));
  }

  /** Sets the server URL "d" tag */
  url(url: string) {
    return this.modifyPublicTags(setSingletonTag(["d", normalizeServerUrl(url)], true));
  }
  name(name: string) {
    return this.modifyPublicTags(name ? setSingletonTag(["name", name], true) : removeSingletonTag("name"));
  }
  description(description: string) {
    return this.content(description);
  }
  /** Marks the server as paid, with an optional description of the pricing */
  paid(paid: false | string) {
    return this.modifyPublicTags(paid === false ? removeSingletonTag("paid") : setSingletonTag(["paid", paid], true));
  }
  /** Marks the server as whitelist only, with an optional description of who can upload */
  whitelist(whitelist: false | string) {
    return this.modifyPublicTags(
      whitelist === false ? removeSingletonTag("whitelist") : setSingletonTag(["whitelist", whitelist], true),
    );
  }
}

/** Builds kind 31963 server reviews */
export class ServerReviewFactory extends EventFactory<typeof SERVER_REVIEW_KIND> {
  static create(server: string, rating: number, text: string) {
    return new ServerReviewFactory((res) => res(blankEventTemplate(SERVER_REVIEW_KIND)))
      .server(server)
      .rating(rating)
      .content(text);
  }

  /** Sets the reviewed server "d" tag */
  server(url: string) {
    return this.modifyPublicTags(setSingletonTag(["d", normalizeServerUrl(url)], true));
  }
  /** Sets the overall rating, a number between 0 and 1 */
  rating(rating: number) {
    const value = Math.min(1, Math.max(0, rating));
    return this.modifyPublicTags(setSingletonTag(["rating", value.toFixed(2)], true));
  }
}
