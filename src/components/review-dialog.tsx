import { DeleteFactory } from "applesauce-core/factories";
import { NostrEvent } from "applesauce-core/helpers";
import { ReactNode, useEffect, useState } from "react";

import { ServerReview } from "@/casts/review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ServerReviewFactory } from "@/factories";
import { getServerHost } from "@/helpers/server";
import { useActivePubkey } from "@/hooks/use-active-account";
import { signAndPublish } from "@/services/publish";
import { openLogin } from "./login-dialog";
import { StarInput } from "./star-rating";

const LABELS = ["", "Terrible", "Poor", "Okay", "Good", "Excellent"];

/** A dialog to write, edit or delete the active user's review of a server */
export function ReviewDialog({ server, review, children }: { server: string; review?: ServerReview; children: ReactNode }) {
  const pubkey = useActivePubkey();
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setStars(review?.stars ? Math.round(review.stars) : 0);
    setText(review?.text ?? "");
    setConfirmDelete(false);
    setError(null);
  }, [open, review]);

  if (!pubkey)
    return (
      <span
        className="contents"
        onClickCapture={(e) => {
          // Ask the user to sign in instead of opening the dialog
          e.preventDefault();
          e.stopPropagation();
          openLogin();
        }}
      >
        {children}
      </span>
    );

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => run(() => signAndPublish(ServerReviewFactory.create(server, stars / 5, text.trim())));
  const remove = () =>
    run(() =>
      signAndPublish(DeleteFactory.fromEvents([review!.event as NostrEvent], `Deleted review of ${getServerHost(server)}`)),
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{review ? "Edit your review" : "Write a review"}</DialogTitle>
          <DialogDescription>{getServerHost(server)}</DialogDescription>
        </DialogHeader>

        {confirmDelete ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">Delete your review? Relays will be asked to remove it, this can't be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={remove} disabled={busy}>
                Delete review
              </Button>
            </div>
          </div>
        ) : (
          <form
            id="review-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (stars > 0) publish();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-3">
                <StarInput value={stars} onChange={setStars} />
                <span className="text-sm text-muted-foreground">{LABELS[stars]}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="review-text">Review</Label>
              <Textarea
                id="review-text"
                rows={5}
                placeholder="How reliable is it? How fast are uploads? Any limits worth knowing about?"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </form>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!confirmDelete && (
          <DialogFooter className="gap-2 sm:justify-between">
            {review ? (
              <Button type="button" variant="ghost" className="text-red-500" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" form="review-form" disabled={busy || stars === 0}>
              {busy ? "Publishing…" : "Publish review"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
