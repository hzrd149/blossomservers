import iconSrc from "@/assets/icon.png";
import { HelpDialog } from "../help-dialog";
import { AddServer } from "../add-server";
import { Login } from "../login";
import { Link } from "react-router-dom";
import useCheckMobile from "../../hooks/use-check-mobile";
import { useTheme } from "../../hooks/use-theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "../ui/button";

export default function Header() {
  const isMobile = useCheckMobile();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <div className="flex gap-2 items-center p-2 w-full">
        <img src={iconSrc} className="w-16" />
        <div>
          <h1 className="text-4xl">Blossom Servers</h1>
          <div className="flex gap-2 ">
            <Link to="/" className="hover:underline p-1">
              Servers
            </Link>
            <Link to="/reviews" className="hover:underline p-1">
              Reviews
            </Link>
          </div>
        </div>

        {!isMobile && (
          <div className="ms-auto flex gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size="16" /> : <Moon size="16" />}
            </Button>
            <HelpDialog />
            <Login />
            <AddServer />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size="16" /> : <Moon size="16" />}
          </Button>
          <HelpDialog />
          <Login />
          <AddServer />
        </div>
      )}
    </>
  );
}
