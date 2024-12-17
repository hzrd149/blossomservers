import { createRoot } from "react-dom/client";
import { QueryStoreProvider, FactoryProvider } from "applesauce-react/providers";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "window.nostr.js";

import "./index.css";
import HomeView from "./views/home/index.tsx";
import { factory, queryStore } from "./core";
import ServerDetailsView from "./views/server/index.tsx";
import Layout from "./components/layout/layout";
import ReviewsView from "./views/reviews";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <QueryStoreProvider queryStore={queryStore}>
      <FactoryProvider factory={factory}>
        <Layout>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/reviews" element={<ReviewsView />} />
            <Route path="/server/:server" element={<ServerDetailsView />} />
          </Routes>
        </Layout>
      </FactoryProvider>
    </QueryStoreProvider>
  </BrowserRouter>,
);
