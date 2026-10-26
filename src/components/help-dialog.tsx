import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SERVER_ADVERTIZEMENT_KIND, SERVER_REPORT_KIND, SERVER_LIST_KIND, SERVER_REVIEW_KIND } from "../const";

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
    {children}
  </a>
);

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="What is this?">
          <HelpCircle size="1.2rem" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>What is this?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            Blossom Servers is a directory for discovering, reviewing and checking the status of public{" "}
            <A href="https://github.com/hzrd149/blossom">Blossom</A> media servers.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              Capability reports use experimental <code>kind:{SERVER_REPORT_KIND}</code> events, one per contributor and
              server URL. They describe what a contributor reports or a browser observed, not ownership or independent
              verification. Legacy <code>kind:{SERVER_ADVERTIZEMENT_KIND}</code> announcements remain readable
              separately.
            </li>
            <li>
              Reviews are <code>kind:{SERVER_REVIEW_KIND}</code> events with a <code>d</code> tag containing the server
              URL, following <A href="https://github.com/nostr-protocol/nips/pull/879">NIP-85 (reviews)</A>.
            </li>
            <li>
              When signed in, user counts include only people you directly follow, using their{" "}
              <code>kind:{SERVER_LIST_KIND}</code> server lists (
              <A href="https://github.com/hzrd149/blossom/blob/master/buds/03.md">BUD-03</A>). Adding a server to your
              list here updates that list for every Blossom app you use.
            </li>
            <li>Comments are NIP-22 comments and "helpful" votes are NIP-25 reactions.</li>
            <li>
              Reports, reviews, legacy announcements and followed users' lists can introduce a URL. Discussions load
              only for the selected server when you open its Discussion tab; comments never introduce servers. Missing
              information is unknown, not proof that service is free or unrestricted. Capability filters require
              matching assertions in a single current report; sources can disagree.
            </li>
            <li>
              Optional reporting checks use anonymous GET/HEAD/OPTIONS requests, without uploading, paying or signing
              authorization. HEAD acceptance is not proof an actual upload or media transformation works.
            </li>
            <li>
              Status is checked from your browser. A server that is unreachable here may be offline, or it may be
              missing the CORS headers web clients need.
            </li>
          </ul>
          <p>
            Built with <A href="https://applesauce.build">applesauce</A>. View the source on{" "}
            <A href="https://github.com/hzrd149/blossomservers">GitHub</A>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
