import { Moon, Plus, Sun } from "lucide-react";
import { NavLink, Link } from "react-router-dom";

import iconSrc from "@/assets/icon.png";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { AccountMenu } from "../account-menu";
import { HelpDialog } from "../help-dialog";
import { ReportDialog } from "../report-dialog";
import { SyncStatus } from "../sync-status";
import { Button } from "../ui/button";

const NAV = [
  { to: "/", label: "Servers", end: true },
  { to: "/reviews", label: "Reviews" },
  { to: "/me", label: "My servers" },
];

function Nav({ className }: { className?: string }) {
  return (
    <nav className={cn("flex gap-1", className)}>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="container mx-auto flex items-center gap-2 px-4 py-2">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src={iconSrc} className="h-9 w-9" alt="" />
          <span className="text-lg font-semibold tracking-tight max-sm:hidden">Blossom Servers</span>
        </Link>

        <Nav className="ml-4 max-md:hidden" />

        <div className="ml-auto flex items-center gap-1">
          <SyncStatus />
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <HelpDialog />
          <ReportDialog>
            <Button variant="outline" size="sm" className="mx-1" title="Report a server's capabilities">
              <Plus size={16} />
              <span className="max-sm:hidden">Report server</span>
            </Button>
          </ReportDialog>
          <AccountMenu />
        </div>
      </div>
      <div className="container mx-auto overflow-x-auto px-4 pb-2 md:hidden">
        <Nav />
      </div>
    </header>
  );
}
