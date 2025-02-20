import { useState } from "react";
import { useForm } from "react-hook-form";
import { Star } from "lucide-react";
import Rating from "react-rating";
import { firstValueFrom } from "rxjs";

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
import { useEventFactory } from "applesauce-react/hooks";

import { rxNostr } from "../nostr";
import { SERVER_REVIEW_KIND } from "../const";
import { Textarea } from "./ui/textarea";
import { includeSingletonTag, setContent } from "applesauce-factory/operations";

export function AddReview({ server }: { server: URL }) {
  const [open, setOpen] = useState(false);
  const factory = useEventFactory();
  const form = useForm({
    defaultValues: {
      content: "",
      rating: 0,
    },
    mode: "all",
  });

  const submit = form.handleSubmit(async (values) => {
    const url = new URL("/", server).toString();

    if (values.rating === 0) {
      return alert("Select rating first");
    }

    const draft = await factory.process(
      { kind: SERVER_REVIEW_KIND, tags: [["d", url]] },
      setContent(values.content),
      includeSingletonTag(["rating", (values.rating / 5).toFixed(2)]),
    );

    await firstValueFrom(rxNostr.send(draft));

    setOpen(false);
  });

  form.watch("rating");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        form.reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="self-end">
          Add Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Review</DialogTitle>
          <DialogDescription>Review {server.host}</DialogDescription>
        </DialogHeader>
        <form id="add-server" className="grid gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain">Rating {form.getValues("rating")}</Label>
            {/* @ts-expect-error */}
            <Rating
              initialRating={form.getValues("rating")}
              fullSymbol={<Star fill="currentColor" size="32" />}
              emptySymbol={<Star size="32" />}
              start={0}
              stop={5}
              onChange={(v) => form.setValue("rating", v, { shouldDirty: true, shouldTouch: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="content">Review</Label>
            <Textarea id="content" {...form.register("content", { required: true })} />
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" disabled={form.formState.isSubmitting} form="add-server">
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
