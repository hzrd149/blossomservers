import { AddBlossomServer, RemoveBlossomServer, SetDefaultBlossomServer } from "applesauce-actions/actions";
import { castUser } from "applesauce-common/casts";
import { BlossomServerListFactory } from "applesauce-common/factories";
import { normalizeToPubkey } from "applesauce-core/helpers";
import { use$ } from "applesauce-react/hooks";
import { ArrowDown, ArrowUp, Crown, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { map } from "rxjs";

import { ServerReview } from "@/casts/review";
import { openLogin } from "@/components/login-dialog";
import { PageHeader } from "@/components/page-header";
import { ReviewCard } from "@/components/review-card";
import { ServerCard } from "@/components/server-card";
import { ReportDialog } from "@/components/report-dialog";
import { ServerFavicon } from "@/components/server-favicon";
import { ServerStatus } from "@/components/server-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import UserAvatar from "@/components/user/user-avatar";
import { SERVER_LIST_KIND } from "@/const";
import { getServerHost, getServerPath, safeNormalizeServerUrl } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { directory$, popularity, ServerSummary } from "@/models/directory";
import { eventStore } from "@/services/nostr";
import { actions, signAndPublish } from "@/services/publish";

type Tab = "list" | "announced" | "reviews";

/** Runs an async edit, reporting failures */
function useEdit() {
  const [busy, setBusy] = useState(false);
  const run = async (edit: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await edit();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** The user's ordered BUD-03 list, editable when it belongs to the active user */
function ServerList({ pubkey, servers, editable }: { pubkey: string; servers: string[]; editable: boolean }) {
  const { busy, run } = useEdit();
  const directory = use$(directory$);
  const [input, setInput] = useState("");
  const url = safeNormalizeServerUrl(input);

  // Suggest popular announced servers the user doesn't have yet
  const suggestions = useMemo(
    () =>
      (directory ?? [])
        .filter((s) => (s.reports.length || s.announcement) && !servers.includes(s.url))
        .sort((a, b) => popularity(b) - popularity(a))
        .slice(0, 6),
    [directory, servers],
  );

  const move = (index: number, offset: number) =>
    run(async () => {
      const list = eventStore.getReplaceable(SERVER_LIST_KIND, pubkey);
      if (!list) throw new Error("Server list not loaded");
      const next = [...servers];
      const [server] = next.splice(index, 1);
      next.splice(index + offset, 0, server);
      await signAndPublish(BlossomServerListFactory.modify(list).servers(next));
    });

  const add = (server: string) =>
    run(async () => {
      await actions.run(AddBlossomServer, server);
      setInput("");
    });

  return (
    <div className="flex flex-col gap-4">
      {editable && (
        <p className="text-sm text-muted-foreground">
          Your server list (BUD-03) tells Blossom apps where to upload your media and where to find it. The first server
          is your default.
        </p>
      )}

      {servers.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">
          {editable ? "Your server list is empty, add a server below." : "This user has no server list."}
        </p>
      ) : (
        <ol className="flex flex-col divide-y rounded-xl border bg-card">
          {servers.map((server, index) => (
            <li key={server} className="flex items-center gap-3 p-3">
              <span className="w-5 text-center text-sm tabular-nums text-muted-foreground">{index + 1}</span>
              <ServerFavicon url={server} />
              <div className="min-w-0 flex-1">
                <Link to={getServerPath(server)} className="block truncate font-medium hover:underline">
                  {getServerHost(server)}
                </Link>
                <div className="flex items-center gap-2">
                  {index === 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Crown size={12} /> Default
                    </span>
                  )}
                  <ServerStatus url={server} showLabel />
                </div>
              </div>
              {editable && (
                <div className="flex shrink-0 items-center">
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 max-sm:hidden"
                      title="Make default"
                      disabled={busy}
                      onClick={() => run(() => actions.run(SetDefaultBlossomServer, server))}
                    >
                      <Crown size={15} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Move up"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Move down"
                    disabled={busy || index === servers.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500"
                    title="Remove"
                    disabled={busy}
                    onClick={() => run(() => actions.run(RemoveBlossomServer, server))}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {editable && (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (url && !servers.includes(url)) add(url);
            }}
          >
            <Input placeholder="https://cdn.example.com" value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit" disabled={busy || !url || servers.includes(url)}>
              <Plus size={16} /> Add
            </Button>
          </form>
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Popular servers</h3>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s.url} variant="outline" size="sm" disabled={busy} onClick={() => add(s.url)}>
                    <ServerFavicon url={s.url} className="h-4 w-4" />
                    {s.host}
                    <Plus size={14} />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserPage({ pubkey, editable }: { pubkey: string; editable: boolean }) {
  const user = useMemo(() => castUser(pubkey, eventStore), [pubkey]);
  const profile = use$(user.profile$);
  const servers = use$(user.blossomServers$)
    ?.map((url) => safeNormalizeServerUrl(url))
    .filter((url) => url !== null);
  const [tab, setTab] = useState<Tab>("list");

  const announced = use$(
    () =>
      directory$.pipe(
        map((dir) =>
          dir.filter((s) => s.contributors.has(pubkey) || s.announcements.some((a) => a.event.pubkey === pubkey)),
        ),
      ),
    [pubkey],
  );
  const reviews = use$(
    () =>
      directory$.pipe(
        map((dir) =>
          dir
            .flatMap((s) => s.reviews)
            .filter((r): r is ServerReview => r.event.pubkey === pubkey)
            .sort((a, b) => b.event.created_at - a.event.created_at),
        ),
      ),
    [pubkey],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <section className="flex items-center gap-4">
        <UserAvatar pubkey={pubkey} className="h-16 w-16 sm:h-20 sm:w-20" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {editable ? "My servers" : profile?.displayName || user.npub.slice(0, 16) + "…"}
          </h1>
          {editable && profile?.displayName && <p className="text-muted-foreground">{profile.displayName}</p>}
          {!editable && profile?.about && <p className="line-clamp-2 text-sm text-muted-foreground">{profile.about}</p>}
        </div>
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "list", label: `Server list (${servers?.length ?? 0})` },
          { id: "announced", label: `Contributions (${announced?.length ?? 0})` },
          { id: "reviews", label: `Reviews (${reviews?.length ?? 0})` },
        ]}
      />

      {tab === "list" && <ServerList pubkey={pubkey} servers={servers ?? []} editable={editable} />}
      {tab === "announced" && (
        <div className="flex flex-col gap-4">
          {editable && (
            <ReportDialog>
              <Button className="self-start">
                <Plus size={16} /> Report server capabilities
              </Button>
            </ReportDialog>
          )}
          {announced?.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {announced.map((server: ServerSummary) => (
                <ServerCard key={server.url} server={server} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-muted-foreground">No reports or legacy announcements.</p>
          )}
        </div>
      )}
      {tab === "reviews" &&
        (reviews?.length ? (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard key={review.uid} review={review} showServer />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-muted-foreground">No reviews yet.</p>
        ))}
    </div>
  );
}

/** A public page for any user */
export default function UserView() {
  const params = useParams();
  const active = useActivePubkey();
  const pubkey = params.user ? normalizeToPubkey(params.user) : null;
  if (!pubkey) return <Navigate to="/" replace />;

  return <UserPage key={pubkey} pubkey={pubkey} editable={pubkey === active} />;
}

/** The active user's own page */
export function MyServersView() {
  const pubkey = useActivePubkey();

  if (!pubkey)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <PageHeader title="My servers" description="Sign in to manage your Blossom server list, reports and reviews." />
        <Button onClick={openLogin}>Sign in</Button>
      </div>
    );

  return <UserPage key={pubkey} pubkey={pubkey} editable />;
}
