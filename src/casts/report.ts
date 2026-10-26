import { CastRefEventStore, EventCast } from "applesauce-common/casts/cast";
import { NostrEvent } from "applesauce-core/helpers";

import { parseReport, reportAssertions, ServerReportData } from "../helpers/report";

export class ServerReport extends EventCast {
  readonly data: ServerReportData;
  constructor(event: NostrEvent, store: CastRefEventStore) {
    const data = parseReport(event);
    if (!data) throw new Error("Invalid server report");
    super(event, store);
    this.data = data;
  }
  get url() {
    return this.event.tags.find((tag) => tag[0] === "d")![1];
  }
  get assertions() {
    return reportAssertions(this.data);
  }
}
