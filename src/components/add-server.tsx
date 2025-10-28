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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { includeSingletonTag } from "applesauce-factory/operations";
import { useEventFactory } from "applesauce-react/hooks";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { setContent } from "applesauce-factory/operations/content";
import { DEFAULT_RELAYS, SERVER_ADVERTIZEMENT_KIND } from "../const";
import { pool } from "../nostr";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";

export function AddServer() {
  const [open, setOpen] = useState(false);
  const factory = useEventFactory();
  const form = useForm({
    defaultValues: {
      domain: "",
      name: "",
      description: "",
      paid: false,
      paidDescription: "",
      whitelist: false,
      whitelistDescription: "",
    },
    mode: "all",
  });

  form.watch("paid");
  form.watch("whitelist");

  const submit = form.handleSubmit(async (values) => {
    if (!factory) return;
    const url = new URL("/", values.domain).toString();

    const draft = await factory.build(
      { kind: SERVER_ADVERTIZEMENT_KIND, tags: [["d", url]] },
      setContent(values.description),
      includeSingletonTag(["name", values.name]),
      values.paid ? includeSingletonTag(["paid", values.paidDescription]) : undefined,
      values.whitelist ? includeSingletonTag(["whitelist", values.whitelistDescription]) : undefined,
    );

    const event = await factory.sign(draft);

    await pool.publish(DEFAULT_RELAYS, event);

    setOpen(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        form.reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button>Add Server</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Server</DialogTitle>
          <DialogDescription>Advertize your blossom server so other users can find it</DialogDescription>
        </DialogHeader>
        <form id="add-server" className="grid gap-4" onSubmit={submit}>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              placeholder="Server Name"
              className="col-span-3"
              {...form.register("name", { required: true })}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="domain" className="text-right">
              Domain
            </Label>
            <Input
              id="domain"
              placeholder="https://cdn.exmaple.com"
              className="col-span-3"
              type="url"
              {...form.register("domain", { required: true })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Short server description" {...form.register("description")} />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="paid"
              checked={form.getValues("paid")}
              onCheckedChange={(checked) => form.setValue("paid", !!checked, { shouldDirty: true, shouldTouch: true })}
            />
            <label
              htmlFor="paid"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Requires payment
            </label>
          </div>
          {form.getValues("paid") && (
            <Input id="paidDescription" placeholder="Describe payment" {...form.register("paidDescription")} />
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="whitelist"
              checked={form.getValues("whitelist")}
              onCheckedChange={(checked) =>
                form.setValue("whitelist", !!checked, { shouldDirty: true, shouldTouch: true })
              }
            />
            <label
              htmlFor="whitelist"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Has whitelist
            </label>
          </div>
          {form.getValues("whitelist") && (
            <Input
              id="whitelistDescription"
              placeholder="Describe payment"
              {...form.register("whitelistDescription")}
            />
          )}
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
