import { getTagValue, NostrEvent } from "applesauce-core/helpers";
import { setContent } from "applesauce-factory/operations/content";
import { includeSingletonTag } from "applesauce-factory/operations";
import { useEventFactory } from "applesauce-react/hooks";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND } from "../const";
import { eventStore, pool } from "../nostr";
import { normalizeServerUrl } from "@/helpers/server";

const EVENT_DELETION_KIND = 5;

interface EditServerProps {
  server: NostrEvent;
  children?: React.ReactNode;
  onDelete?: () => void;
}

interface ServerFormValues {
  domain: string;
  name: string;
  description: string;
  paid: boolean;
  paidDescription: string;
  whitelist: boolean;
  whitelistDescription: string;
}

export function EditServer({ server, children, onDelete }: EditServerProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const factory = useEventFactory();
  const domain = getTagValue(server, "d") || "";

  const form = useForm<ServerFormValues>({
    defaultValues: {
      domain,
      name: getTagValue(server, "name") || "",
      description: server.content || "",
      paid: server.tags.some((t) => t[0] === "paid"),
      paidDescription: getTagValue(server, "paid") || "",
      whitelist: server.tags.some((t) => t[0] === "whitelist"),
      whitelistDescription: getTagValue(server, "whitelist") || "",
    },
    mode: "all",
  });

  form.watch("paid");
  form.watch("whitelist");

  const submit = form.handleSubmit(async (values) => {
    if (!factory) return;
    const url = normalizeServerUrl(values.domain);

    const draft = await factory.build(
      {
        kind: SERVER_ADVERTIZEMENT_KIND,
        tags: [
          ["d", url],
          ["e", server.id],
        ],
      },
      setContent(values.description),
      includeSingletonTag(["name", values.name]),
      values.paid ? includeSingletonTag(["paid", values.paidDescription]) : undefined,
      values.whitelist ? includeSingletonTag(["whitelist", values.whitelistDescription]) : undefined,
    );

    const event = await factory.sign(draft);

    await pool.publish(DEFAULT_RELAYS, event);

    setOpen(false);
  });

  const handleDelete = async () => {
    if (!factory) return;

    const domain = getTagValue(server, "d");
    const draft = await factory.build(
      {
        kind: EVENT_DELETION_KIND,
        tags: [
          ["e", server.id],
          ["a", `${SERVER_ADVERTIZEMENT_KIND}:${server.pubkey}:${domain}`],
        ],
      },
      setContent(`Deleted server ${getTagValue(server, "name")}`),
    );

    const event = await factory.sign(draft);

    await pool.publish(DEFAULT_RELAYS, event);

    // Delete from nostrdb
    if (window.nostrdb) {
      try {
        (window.nostrdb as any).deleteEvent(server.id);
      } catch (err) {
        console.error("Failed to delete from nostrdb:", err);
      }
    }

    // Remove from event store to trigger re-render
    eventStore.remove(server.id);

    setShowDeleteConfirm(false);
    setOpen(false);

    if (onDelete) {
      onDelete();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        form.reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            Edit Server
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Server</DialogTitle>
          <DialogDescription>Update your server information</DialogDescription>
        </DialogHeader>
        <form id="edit-server" className="grid gap-4" onSubmit={submit}>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-name" className="text-right">
              Name
            </Label>
            <Input
              id="edit-name"
              placeholder="Server Name"
              className="col-span-3"
              {...form.register("name", { required: true })}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-domain" className="text-right">
              Domain
            </Label>
            <Input
              id="edit-domain"
              placeholder="https://cdn.example.com"
              className="col-span-3"
              type="url"
              {...form.register("domain", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" placeholder="Short server description" {...form.register("description")} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-paid"
              checked={form.getValues("paid")}
              onCheckedChange={(checked) => form.setValue("paid", !!checked, { shouldDirty: true, shouldTouch: true })}
            />
            <label
              htmlFor="edit-paid"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Requires payment
            </label>
          </div>
          {form.getValues("paid") && (
            <Input id="edit-paidDescription" placeholder="Describe payment" {...form.register("paidDescription")} />
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-whitelist"
              checked={form.getValues("whitelist")}
              onCheckedChange={(checked) =>
                form.setValue("whitelist", !!checked, { shouldDirty: true, shouldTouch: true })
              }
            />
            <label
              htmlFor="edit-whitelist"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Has whitelist
            </label>
          </div>
          {form.getValues("whitelist") && (
            <Input
              id="edit-whitelistDescription"
              placeholder="Describe whitelist requirements"
              {...form.register("whitelistDescription")}
            />
          )}
        </form>
        <DialogFooter>
          <div className="flex justify-between items-center w-full">
            <Button type="button" variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              Delete Server
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting} form="edit-server">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Server?</DialogTitle>
            <DialogDescription>
              This will remove your server from the network. This action cannot be undone.
            </DialogDescription>
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
