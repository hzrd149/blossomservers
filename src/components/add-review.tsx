import { NostrEvent } from "applesauce-core/helpers";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { Content, includeSingletonTag } from "applesauce-factory/operations";
import { useEventFactory } from "applesauce-react/hooks";

import { DEFAULT_RELAYS, SERVER_REVIEW_KIND } from "../const";
import { eventStore, pool } from "../nostr";
import { StarRating } from "./star-rating";
import { Textarea } from "./ui/textarea";
import { useUser } from "@/contexts/user-context";

const EVENT_DELETION_KIND = 5;

function getReviewRating(review: NostrEvent): number | null {
  const ratingTag = review.tags.find((t) => t[0] === "rating" && t[1] && !t[2]);
  if (ratingTag) {
    const value = parseFloat(ratingTag[1]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function AddReview({ server, review, onDelete }: { server: URL; review?: NostrEvent; onDelete?: () => void }) {
  const { isLoggedIn, pubkey } = useUser();
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const factory = useEventFactory();
  const existingRating = review ? getReviewRating(review) : null;
  const form = useForm({
    defaultValues: {
      content: review?.content || "",
      rating: existingRating ? existingRating * 5 : 0,
    },
    mode: "all",
  });

  const submit = form.handleSubmit(async (values) => {
    if (values.rating === 0) {
      return alert("Select rating first");
    }

    const url = server.toString();
    const tags: string[][] = [["d", url]];

    const draft = await factory.build(
      { kind: SERVER_REVIEW_KIND, tags },
      Content.setContent(values.content),
      includeSingletonTag(["rating", (values.rating / 5).toFixed(2)]),
    );

    const event = await factory.sign(draft);

    await pool.publish(DEFAULT_RELAYS, event);

    setOpen(false);
  });

  const handleDelete = async () => {
    if (!factory || !review) return;

    const draft = await factory.build(
      {
        kind: EVENT_DELETION_KIND,
        tags: [
          ["e", review.id],
          ["a", `${SERVER_REVIEW_KIND}:${review.pubkey}:${server.toString()}`],
        ],
      },
      Content.setContent(`Deleted review for ${server.host}`),
    );

    const event = await factory.sign(draft);

    await pool.publish(DEFAULT_RELAYS, event);

    // Delete from nostrdb
    if (window.nostrdb) {
      try {
        (window.nostrdb as any).deleteEvent(review.id);
      } catch (err) {
        console.error("Failed to delete from nostrdb:", err);
      }
    }

    // Remove from event store to trigger re-render
    eventStore.remove(review.id);

    setShowDeleteConfirm(false);
    setOpen(false);

    if (onDelete) {
      onDelete();
    }
  };

  form.watch("rating");

  if (!isLoggedIn) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        form.reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {review ? (
          <Button variant="outline" size="sm">
            Edit Review
          </Button>
        ) : (
          <Button variant="outline" className="self-end">
            Add Review
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{review ? "Edit Review" : "Add Review"}</DialogTitle>
          <DialogDescription>
            {review ? "Update your review for" : "Review"} {server.host}
          </DialogDescription>
        </DialogHeader>
        <form id={review ? "edit-review" : "add-review"} className="grid gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain">Rating {form.getValues("rating")}</Label>
            <StarRating
              value={form.getValues("rating")}
              size="32"
              readonly={false}
              onChange={(v) => form.setValue("rating", v, { shouldDirty: true, shouldTouch: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">Review</Label>
            <Textarea id="content" {...form.register("content", { required: true })} />
          </div>
        </form>
        <DialogFooter>
          <div className="flex justify-between items-center w-full">
            {review && review.pubkey === pubkey && (
              <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                Delete Review
              </Button>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting} form={review ? "edit-review" : "add-review"}>
              Publish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>This will remove your review. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
