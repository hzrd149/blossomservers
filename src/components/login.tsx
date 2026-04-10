import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Link } from "react-router-dom";
import { getTagValue } from "applesauce-core/helpers";
import { TimelineModel } from "applesauce-core/models";
import { useEventModel } from "applesauce-react/hooks";
import { SERVER_ADVERTIZEMENT_KIND } from "@/const";
import UserAvatar from "./user/user-avatar";
import UserName from "./user/user-name";
import { Table, TableBody, TableCell as TableCellComp, TableHead, TableHeader, TableRow } from "./ui/table";
import CopyButton from "./copy-button";
import { useUser } from "@/contexts/user-context";
import { normalizeServerUrl } from "@/helpers/server";

function UserServersTable({ pubkey }: { pubkey: string }) {
  const servers = useEventModel(TimelineModel, [{ kinds: [SERVER_ADVERTIZEMENT_KIND], authors: [pubkey] }]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>URL</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers?.map((server) => {
          const url = new URL(normalizeServerUrl(getTagValue(server, "d")!));
          return (
            <TableRow key={server.id}>
              <TableCellComp className="font-medium">{getTagValue(server, "name")}</TableCellComp>
              <TableCellComp className="flex items-center">
                <a href={url.toString()} target="_blank">
                  {url.host}
                </a>
                <CopyButton
                  data={url.toString()}
                  variant="ghost"
                  className="ms-2"
                  title="Copy URL"
                  aria-label="Copy URL"
                />
              </TableCellComp>
              <TableCellComp className="text-right">
                <Link to={`/server/${url.host}`} className="hover:underline">
                  View
                </Link>
              </TableCellComp>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function Login() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn, pubkey, login, logout } = useUser();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await login();
    } catch (error) {
      alert("Failed to login. Make sure you have a nostr extension installed and unlocked.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    logout();
    setOpen(false);
  };

  if (isLoggedIn && pubkey) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <UserAvatar pubkey={pubkey} />
            <span className="ml-2">Account</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Account</DialogTitle>
            <DialogDescription>Your identity is managed by your Nostr browser extension</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex items-center gap-4 p-4 border rounded">
              <UserAvatar pubkey={pubkey} />
              <div className="flex-1">
                <UserName pubkey={pubkey} />
                <div className="text-sm text-muted-foreground">{pubkey.slice(0, 8)}...</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
            <div>
              <h3 className="font-medium mb-2">Your Servers</h3>
              <UserServersTable pubkey={pubkey} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Login</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Login</DialogTitle>
          <DialogDescription>Login with your Nostr extension to manage your servers</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Button onClick={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? "Connecting..." : "Connect with Nostr Extension"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Install a Nostr browser extension (like Alby, Nos2x, or Flint) to login.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
