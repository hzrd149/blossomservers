import { AccountsProvider, ActionsProvider, EventStoreProvider } from "applesauce-react/providers";
import { use$ } from "applesauce-react/hooks";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";

import Layout from "./components/layout/layout";
import { accounts } from "./services/accounts";
import { eventStore } from "./services/nostr";
import { actions } from "./services/publish";
import { directorySync$ } from "./services/sync";
import HomeView from "./views/home";
import ReviewsView from "./views/reviews";
import ServerView from "./views/server";
import UserView, { MyServersView } from "./views/user";

function App() {
  // Keep the directory synced for the lifetime of the app
  use$(directorySync$);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/reviews" element={<ReviewsView />} />
        <Route path="/server/:server" element={<ServerView />} />
        <Route path="/user/:user" element={<UserView />} />
        <Route path="/me" element={<MyServersView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <EventStoreProvider eventStore={eventStore}>
      <AccountsProvider manager={accounts}>
        <ActionsProvider runner={actions}>
          <App />
        </ActionsProvider>
      </AccountsProvider>
    </EventStoreProvider>
  </BrowserRouter>,
);
