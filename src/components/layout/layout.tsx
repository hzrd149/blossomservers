import { PropsWithChildren } from "react";

import { LoginDialog } from "../login-dialog";
import Header from "./header";

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="container mx-auto flex-1 px-4 py-6">{children}</main>
      <LoginDialog />
    </div>
  );
}
