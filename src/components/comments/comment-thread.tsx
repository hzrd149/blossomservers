import { CreateComment } from "applesauce-actions/actions";
import { Comment } from "applesauce-common/casts";
import { CommentPointer } from "applesauce-common/helpers";
import { NostrEvent } from "applesauce-core/helpers";
import { use$ } from "applesauce-react/hooks";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActivePubkey } from "@/hooks/use-active-account";
import { formatRelative } from "@/lib/time";
import { actions } from "@/services/publish";
import { openLogin } from "../login-dialog";
import UserAvatar from "../user/user-avatar";
import UserName from "../user/user-name";

/** A text box that publishes a NIP-22 comment on a parent event, comment or external pointer */
export function CommentForm({
  parent,
  placeholder = "Write a comment…",
  onDone,
  autoFocus,
}: {
  parent: NostrEvent | CommentPointer;
  placeholder?: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const pubkey = useActivePubkey();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pubkey)
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={openLogin}>
        Sign in to comment
      </Button>
    );

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      await actions.run(CreateComment, parent, text.trim());
      setText("");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
    >
      <Textarea
        rows={2}
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) post();
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {error && <p className="mr-auto text-sm text-red-500">{error}</p>}
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {busy ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

/** A single comment with its nested replies */
function CommentItem({ comment, depth }: { comment: Comment; depth: number }) {
  const replies = use$(comment.replies$);
  const [replying, setReplying] = useState(false);

  return (
    <div className="flex gap-3">
      <UserAvatar pubkey={comment.event.pubkey} className="h-7 w-7" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2 text-sm">
          <UserName pubkey={comment.event.pubkey} />
          <time className="text-xs text-muted-foreground" title={comment.createdAt.toLocaleString()}>
            {formatRelative(comment.event.created_at)}
          </time>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{comment.event.content}</p>
        <div>
          <button
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setReplying((v) => !v)}
          >
            Reply
          </button>
        </div>
        {replying && (
          <CommentForm parent={comment.event} placeholder="Write a reply…" onDone={() => setReplying(false)} autoFocus />
        )}
        {replies && replies.length > 0 && (
          <div className={depth < 4 ? "mt-2 flex flex-col gap-3 border-l pl-3" : "mt-2 flex flex-col gap-3"}>
            {[...replies].reverse().map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A list of top level comments, oldest first, with a box to add a new one */
export function CommentThread({
  parent,
  comments,
  placeholder,
}: {
  parent: NostrEvent | CommentPointer;
  comments: Comment[] | undefined;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {comments && comments.length > 0 ? (
        [...comments].reverse().map((comment) => <CommentItem key={comment.id} comment={comment} depth={0} />)
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare size={14} /> No comments yet
        </p>
      )}
      <CommentForm parent={parent} placeholder={placeholder} />
    </div>
  );
}
