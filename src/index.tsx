import { EventStoreProvider, FactoryProvider } from "applesauce-react/providers";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "window.nostr.js";
import "window.nostrdb.js";
import "./index.css";

import Layout from "./components/layout/layout";
import { eventStore, factory } from "./nostr.ts";
import HomeView from "./views/home/index.tsx";
import ReviewsView from "./views/reviews";
import ServerDetailsView from "./views/server/index.tsx";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <EventStoreProvider eventStore={eventStore}>
      <FactoryProvider factory={factory}>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/reviews" element={<ReviewsView />} />
            <Route path="/server/:server" element={<ServerDetailsView />} />
          </Routes>
        </Layout>
      </FactoryProvider>
    </EventStoreProvider>
  </BrowserRouter>,
);
