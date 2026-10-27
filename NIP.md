# Blossom Server Reports

`draft` `optional` `application protocol`

This document specifies **kind `36364`**, an addressable Nostr event for sharing
attributed knowledge about a public [Blossom](https://github.com/hzrd149/blossom)
server. Other applications can publish, discover, validate, and display these
reports without depending on blossomservers.com.

**Status:** experimental, version 1. This is not an assigned or accepted NIP.
Kind `36364` is provisional; public allocation and collision coordination remain
outstanding. A search on 2026-10-26 found no collision in the official NIP kind
table, `nostr-protocol/registry-of-kinds/schema.yaml`, the Blossom BUD index/NIP-B7,
or a NIPs issue search. That is not proof of exclusive use.

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** describe
requirements for this application protocol, not additional requirements on
general-purpose Nostr relays. The reference implementation's presentation and
freshness policies are identified separately below.

## Purpose and trust model

A report is a contributor's account of server features and upload requirements,
optionally accompanied by narrowly scoped browser observations. It is **not** an
operator announcement, ownership proof, audit, uptime guarantee, or certification
of BUD compliance. A signature identifies the reporting key, not the server
operator or a verified person. Any key can report on any eligible server.

Manual claims and observations MUST remain distinguishable. Clients MUST NOT turn
a successful metadata check into proof of actual upload, mirroring, or media
processing support. Reports can disagree; this protocol does not elect an
authoritative contributor.

## Event format

Reports use the [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md)
event envelope, signature verification, and addressable-event replacement rules.
The address is:

```text
36364:<author-pubkey>:<canonical-server-URL>
```

There is one current report per author/server pair. Different authors' reports
have different addresses and MUST NOT replace one another.

Required tags are:

| Tag                                     | Cardinality  | Meaning                                                    |
| --------------------------------------- | ------------ | ---------------------------------------------------------- |
| `["d", "<canonical-server-URL>"]`       | Exactly one  | The reported server's identity.                            |
| `["schema", "blossom-server-report/1"]` | Exactly one  | Payload version; MUST equal the content's `schema`.        |
| `["c", "<index-value>"]`                | Zero or more | Exact index of the manual claims and derived observations. |

Each `d`, `schema`, and `c` tag MUST have exactly two string elements. Other tag
names MAY be present and MUST NOT change report semantics. The event MUST contain
at most 64 tags, each containing at most four strings, each string at most 2048
UTF-16 code units. Tag order is not significant.

`content` MUST be a JSON-encoded object, not prose. For example, this unsigned
event template has consistent content and indexes; a publisher supplies the
normal `pubkey`, `id`, and `sig` fields when signing:

```json
{
  "kind": 36364,
  "created_at": 1793000000,
  "tags": [
    ["d", "https://cdn.example.com/"],
    ["schema", "blossom-server-report/1"],
    ["c", "mirror"],
    ["c", "!upload-payment"],
    ["c", "upload-preflight-accepted"]
  ],
  "content": "{\"schema\":\"blossom-server-report/1\",\"name\":\"Example CDN\",\"description\":\"A contributor's description, not operator metadata.\",\"probeSuite\":\"browser-head/2\",\"claims\":[{\"capability\":\"mirror\",\"value\":true,\"assertedAt\":1793000000},{\"capability\":\"upload-payment\",\"value\":false,\"assertedAt\":1793000000}],\"observations\":[{\"endpoint\":\"upload\",\"checkedAt\":1793000000,\"duration\":120,\"status\":200,\"fixture\":\"png-68\",\"payments\":[]}]}"
}
```

### Server URL identity

Publishers MUST normalize input before constructing `d`. Readers MUST reject a
`d` value that is not already canonical; silently normalizing an incoming `d`
would change its signed address.

Use WHATWG URL parsing and serialization, with these constraints:

1. Require `https:` and a domain hostname; reject credentials and IP literals.
2. Lowercase the hostname and remove a trailing hostname dot. Internationalized
   domain names use the URL parser's ASCII serialization.
3. Require a hostname containing a dot. Reject all-numeric/dotted-numeric hosts,
   hosts containing `:`, `localhost`, and names ending in `.localhost`, `.local`,
   `.internal`, `.lan`, `.home`, `.test`, `.invalid`, `.example`, or `.home.arpa`.
4. Set the path to `/` and remove the query and fragment.
5. Omit the default HTTPS port (`443`); retain non-default ports.

For example, `https://CDN.Example.com.:443/files?x=1#part` becomes
`https://cdn.example.com/`. `https://cdn.example.com:8443/` is a different server
identity. Subpath deployments are not separately addressable in this version.
User interfaces MAY accept a bare hostname and prepend `https://`; event `d`
values MUST contain the complete canonical URL.

These syntactic restrictions do not establish that a hostname resolves publicly
and are not DNS-rebinding protection. A reader MUST NOT automatically fetch a
reported URL merely because it passed validation.

## Content schema

All six top-level fields are required, including empty strings and arrays:

| Field          | Type   | Constraints                                                                      |
| -------------- | ------ | -------------------------------------------------------------------------------- |
| `schema`       | string | Exactly `blossom-server-report/1`.                                               |
| `name`         | string | Contributor's suggested name; at most 120 UTF-16 code units.                     |
| `description`  | string | Attributed description; at most 4000 UTF-16 code units.                          |
| `probeSuite`   | string | `browser-head/2` or legacy `browser-head/1`, even when observations are empty.   |
| `claims`       | array  | Zero to six unique manual capability claims.                                     |
| `observations` | array  | At most one observation per endpoint; at most four in suite 2, three in suite 1. |

Content MUST NOT exceed 32768 UTF-8 bytes. Unknown JSON fields at the top level,
in claims, or in observations MUST cause rejection in this version. Future
payload formats require an explicitly supported schema rather than permissive
interpretation of new fields.

`created_at`, `assertedAt`, and `checkedAt` are positive Unix timestamps in
seconds, representable as safe integers (`1` through `9007199254740991`).
`created_at` MUST NOT be more than 300 seconds ahead of the reader's current
time. Each claim/observation timestamp MUST NOT exceed `created_at + 300`.
Publication time does not refresh the underlying evidence timestamps.

### Manual claims

Each claim MUST contain exactly `capability`, `value`, and `assertedAt`:

```json
{ "capability": "upload-payment", "value": false, "assertedAt": 1793000000 }
```

`value` MUST be a boolean. A capability MUST NOT occur more than once, even with
different values. Only these capabilities are permitted:

| Capability           | Meaning of `true`                               | Meaning of `false`                                  |
| -------------------- | ----------------------------------------------- | --------------------------------------------------- |
| `upload`             | Blob uploads are supported.                     | Blob uploads are not supported.                     |
| `mirror`             | Remote-URL mirroring is supported.              | Remote-URL mirroring is not supported.              |
| `media`              | Server-managed media optimization is supported. | Server-managed media optimization is not supported. |
| `upload-auth`        | Upload authorization is required.               | Upload authorization is not required.               |
| `upload-payment`     | Upload payment is required.                     | Upload payment is not required.                     |
| `restricted-uploads` | Upload access is restricted.                    | Upload access is public/unrestricted.               |

All meanings are attributed to the contributor, not established facts. Requirement
claims describe uploads, not all operations. Missing claims mean **unknown or
withdrawn**, never `false`. For example, an omitted `upload-payment` claim does
not mean free uploads. A generic HTTP 403 does not establish restricted uploads.

### Observations

An HTTP response observation looks like:

```json
{
  "endpoint": "upload",
  "checkedAt": 1793000000,
  "duration": 120,
  "status": 402,
  "fixture": "png-68",
  "payments": ["cashu"],
  "allow": ["HEAD", "PUT"]
}
```

A failed fetch instead looks like:

```json
{
  "endpoint": "mirror",
  "checkedAt": 1793000000,
  "duration": 8000,
  "failure": "timeout",
  "payments": []
}
```

Rules:

- `endpoint`, `checkedAt`, `duration`, and `payments` are required. `endpoint` is
  `root`, `upload`, `media`, or `mirror`; suite 1 excludes `mirror`.
- `duration` is a finite number of elapsed milliseconds from 0 through 120000,
  inclusive. It need not be an integer.
- Exactly one of `status` and `failure` MUST be present. `status` is an integer
  HTTP response code from 100 through 599, not necessarily a successful response.
  `failure` is either `timeout` or `network-or-cors`.
- `fixture` MUST be `png-68` for `upload` and `media`, including failures. It MUST
  be absent for `root` and `mirror`.
- `payments` is a unique array containing only `cashu` and/or `lightning`, at most
  two items. It MUST be empty unless `status` is 402. A nonempty browser-readable
  `X-Cashu` header records `cashu`; a nonempty `X-Lightning` records `lightning`.
  Header contents MUST NOT be serialized. An empty array does not prove absence
  of payment support; CORS may hide the headers.
- Optional `allow` is permitted only in suite 2 and only for HTTP responses. If
  present, it MUST be a nonempty unique array of at most seven uppercase values
  from `GET`, `HEAD`, `PUT`, `POST`, `DELETE`, `OPTIONS`, `PATCH`. It records the
  readable endpoint `Allow` header, not `Access-Control-Allow-Methods`.
- Failures MUST NOT include `status` or `allow` and MUST have empty `payments`.

## Capability indexes (`c` tags)

Publishers MUST derive indexes from content. Readers MUST recompute them and
reject reports with missing, extra, or duplicate `c` tags. Compare the complete
multiset of values, ignoring order; timestamps and freshness do not affect index
derivation.

1. Each manual claim produces its capability name when `true`, or the name
   prefixed with `!` when `false` (for example, `!upload-payment`).
2. Each `upload` or `media` response with one of the following statuses produces
   the corresponding positive index:

   | Status | Index (`<endpoint>` = `upload` or `media`) |
   | ------ | ------------------------------------------ |
   | 200    | `<endpoint>-preflight-accepted`            |
   | 401    | `<endpoint>-auth-challenge`                |
   | 402    | `<endpoint>-payment-challenge`             |

3. Each `upload`, `media`, or `mirror` response whose `allow` includes `PUT`
   produces `<endpoint>-put-advertised`, independently of status.

Root observations, failed fetches, and other statuses produce no indexes beyond
the rules above. Observations never produce negative indexes or the manual
`upload`, `mirror`, `media`, `upload-auth`, `upload-payment`, or
`restricted-uploads` predicates. Payment method indicators produce no indexes.

`preflight-accepted` names acceptance of the HEAD test metadata; it does not mean
that a browser CORS preflight or an actual write verified the feature. Even a
generic non-Blossom server can respond 200. Likewise `put-advertised` means an
advertisement, not a successful write test.

## Browser probe suites

### `browser-head/2`

Checks MUST be explicitly user-requested, anonymous, sequential, cancellable,
and non-writing. Perform at most these four explicit requests, with an
eight-second timeout per request, plus browser-managed CORS preflights:

| Endpoint | Request           | Purpose                                                                               |
| -------- | ----------------- | ------------------------------------------------------------------------------------- |
| `root`   | `GET /`           | HTTP reachability; cancel the body after reading headers.                             |
| `upload` | `HEAD /upload`    | Test acceptance of fixed fixture metadata without uploading.                          |
| `media`  | `HEAD /media`     | Test acceptance of fixed fixture metadata without processing or uploading.            |
| `mirror` | `OPTIONS /mirror` | Read an endpoint-specific method advertisement without requesting a mirror operation. |

Requests MUST use the equivalent of `mode: "cors"`, `credentials: "omit"`,
`referrerPolicy: "no-referrer"`, `cache: "no-store"`, and `redirect: "error"`.
Clients MUST NOT send authentication signatures, payments, listing requests, or
write requests as part of this suite. User cancellation aborts the run rather
than publishing a cancellation as server-failure evidence.

Both HEAD requests send:

```text
X-SHA-256: 1f3b40322c29a8108ead1415f2aae739495eaee8b1952323ffcdc1a4258ea186
X-Content-Type: image/png
X-Content-Length: 68
```

The `png-68` fixture is this 68-byte PNG, base64-encoded. Its bytes are **not**
sent by the probes:

```text
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=
```

Read `Allow` only when exposed to browser JavaScript and at most 256 UTF-16 code
units long. Split on commas, trim, uppercase, discard unrecognized methods, and
deduplicate. Omit `allow` if no recognized methods remain. A root `allow` MAY be
recorded but generates no index. Missing or unexposed headers remain unknown.
Servers need to expose `Allow`, `X-Cashu`, and `X-Lightning` through
`Access-Control-Expose-Headers` for these observations to be readable.

Generic `Access-Control-Allow-Methods` values MUST NOT become feature evidence.
Some servers permit ordinary Blossom requests but reject explicit cross-origin
OPTIONS queries; this leaves mirror support unknown. The BUDs do not define a
general supported-features header.

Interpret observations conservatively:

- 403 means request denied, not necessarily allowlisting.
- 413/415 reject the tested size/type, not all uploads.
- 429/503 are contextual transient results.
- 404/405 are inconclusive because HEAD endpoints are optional.
- Fetch failure cannot distinguish CORS, network, DNS, TLS, redirects, or browser
  policy and is not global offline evidence.

Fresh checks replace the observation snapshot and set `probeSuite` to
`browser-head/2`. Editing prose MUST NOT refresh evidence timestamps. Clients
SHOULD let authors remove old observations and review content before signing;
detected hints MUST NOT silently change their manual claims.

### Legacy `browser-head/1`

Readers MUST also accept suite 1 within schema `blossom-server-report/1`. It uses
the same fixture and root/upload/media checks, but has no mirror observation and
no `allow` fields. The same status-derived indexes and conservative meanings
apply. Do not reinterpret suite 1 as suite 2 or infer method advertisements from
it. Publishing a fresh suite 2 snapshot does not refresh retained manual claims.

## Replacement and withdrawal

Each replacement is a **complete snapshot**, not a patch. Omitted claims or
observations remove the author's prior assertions; clients MUST NOT merge old
evidence back into the current report. Apply NIP-01's latest-event rule per
address, including its lowest-lexical-ID tie-break for equal `created_at` values.
Ignore malformed or unsupported reports without terminating ingestion.

Authors withdraw reports using a signed kind `5`
[NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) deletion
request. Clients MUST verify deletion authorization against the report author.
For example, these tags target the report event and address:

```json
[
  ["e", "<report-event-id>"],
  ["a", "36364:<report-author-pubkey>:https://cdn.example.com/"],
  ["k", "36364"]
]
```

Follow NIP-09's event/address and timestamp semantics; an `a` tag is not a
permanent ban on future reports. Withdrawal affects only that author's report,
not other contributors or the server's identity. Historical versions may be
discarded, and relay retention or deletion propagation is not guaranteed.
Clients MUST NOT promise network-wide erasure or recoverability.

## Discovery and queries

No special relay implementation is required beyond support for NIP-01
addressable events and single-letter tag filters. Standard filter examples:

```json
{ "kinds": [36364] }
```

```json
{ "kinds": [36364], "#d": ["https://cdn.example.com/"] }
```

```json
{ "kinds": [36364], "authors": ["<author-pubkey>"], "#d": ["https://cdn.example.com/"] }
```

```json
{ "kinds": [36364], "#c": ["upload", "mirror"] }
```

The last filter means upload **OR** mirror under NIP-01, not both. A filter with
`"#c":["!upload-payment"]` matches an explicit negative claim, not an absent one.
The multi-letter `schema` tag is not a standard relay-indexed tag; validate it
locally.

The [AND-filter proposal](https://github.com/nostr-protocol/nips/pull/1365)
describes an optional `{"kinds":[36364],"&c":["upload","mirror"]}` query.
It is not a dependency or an assigned NIP-91. Clients MUST NOT assume support;
use broad synchronization and local validation/filtering when support is unknown.

Indexes are discovery aids, not trusted evidence. Always validate signatures,
schema, content, exact indexes, current replacements, authorized deletions, and
freshness locally. A tag-filtered response alone can omit a newer replacement
that withdrew the queried capability; clients SHOULD synchronize current reports
and deletions rather than treating matching historical events as current state.
`since` filters publication time, not assertion time. Sorting and numeric
comparisons are client-side.

## Reference client policies (non-normative)

blossomservers.com uses the following policies; other applications MAY choose
different presentation, trust, or freshness thresholds without changing events:

- Group all authors' current reports under the canonical URL. Contributor counts
  count distinct public keys, not verified people.
- Show evidence as positive, negative, conflicting, stale, or unknown. No
  newest-author-wins server configuration or authoritative selected description.
  Keep names and descriptions attributed; the domain remains the entry title.
- Use neutral descriptive feature labels such as “Auth required,” “Public
  uploads,” “Free uploads,” and “Paid uploads,” rather than audit pass/fail marks.
  Keep technical observations and raw data collapsed by default.
- Manual claims are filter-eligible for 90 days; observations for 24 hours,
  inclusive. Evidence more than 300 seconds ahead of current time is ineligible.
  Re-evaluate freshness every minute without requiring new events. Republishing
  old evidence does not extend its eligibility.
- Require a **single current report** with every requested fresh positive
  predicate for compound capability filtering. Never join Alice's upload claim
  with Bob's mirror claim. Conflicts describe loaded sources, not global consensus.
- Synchronize reports broadly and filter locally; do not assume AND-query support
  from default relays or the local cache. Show pending/failed synchronization
  without implying complete knowledge of the network.
- Reviews, direct-follow BUD-03 lists, and legacy announcements may introduce
  directory entries without reports. NIP-22 web comments do not introduce servers
  or update directory activity. Discussions are scoped to the exact selected URL,
  loaded on demand with an initial limit of 50 events per relay/cache query and a
  live subscription only while the Discussion tab is open. Review comments have
  a separate review-kind scope.

## Legacy announcements

Kind `36363` is not this protocol. The reference client reads it as legacy
contributor descriptions and does not interpret missing flags as free or public
uploads. An author may explicitly import their own old name, description, and
positive paid/restricted flags for review before signing a new report. Imported
claims keep the original publication timestamp and may already be stale.

There is no automatic conversion, deletion, rewriting, or dual publication.
After a report is withdrawn, remaining legacy sources stay labeled legacy and
MUST NOT be promoted into current report capability evidence.

## Security and privacy

- Treat all text and claims as untrusted third-party data. Escape rendered text;
  never interpret report content as executable markup or application instructions.
- Do not serialize arbitrary response headers or bodies, tokens, invoices,
  proofs, IP addresses, location, or private listings. Reports and their history
  may remain publicly accessible after withdrawal.
- Probes disclose the requesting client's network address to the target server.
  They require explicit consent; reading a report need not contact the server.
- URL checks do not replace browser network protections. Non-browser clients
  need their own private-network/SSRF and DNS-rebinding protections. Redirects
  MUST NOT be followed by these probe suites.
- Neither many reporting keys nor a recent timestamp proves accuracy. Applications
  may layer trust policies on top without treating them as protocol guarantees.

## Implementation and references

The reference implementation is in [`src/helpers/report.ts`](src/helpers/report.ts)
(validation, URL identity, indexes, freshness),
[`src/services/probe.ts`](src/services/probe.ts) (browser checks), and
[`src/casts/report.ts`](src/casts/report.ts) (event decoding).
Protocol and integration tests run with `pnpm test`; `pnpm build` type-checks and
builds the app. `node tests/browser-probes.mjs` additionally tests actual browser
CORS behavior using isolated local HTTPS fixtures. It requires Chrome, openssl,
and Node with global WebSocket (`CHROME_BIN` overrides Chrome). Its certificate
bypass is test-only, never a production probe option.

Known-blob retrieval/range/hash checks, authenticated or active write tests,
scheduled monitoring, remote AND-query optimization, and public kind allocation
are outside this version.

Related specifications:

- [NIP-01: Events, filters, and addressable lifecycle](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-09: Event deletion requests](https://github.com/nostr-protocol/nips/blob/master/09.md)
- [NIP-66: Relay discovery and liveness monitoring](https://github.com/nostr-protocol/nips/blob/master/66.md) — related monitoring work, not the format used here.
- [Blossom BUDs](https://github.com/hzrd149/blossom)
- [AND-filter proposal](https://github.com/nostr-protocol/nips/pull/1365)
- [CORS header exposure](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers)
