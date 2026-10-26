// Optional real-browser integration check, without adding a browser automation dependency.
// Requires Google Chrome (CHROME_BIN overrides), openssl, and Node with global WebSocket.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createHttpsServer } from "node:https";
import { join } from "node:path";
import { createServer as createViteServer } from "vite";

const temporary = await mkdtemp("/tmp/opencode/blossom-probes-");
let chrome, vite, fixture, socket;
try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=*.example.com",
      "-keyout",
      join(temporary, "key.pem"),
      "-out",
      join(temporary, "cert.pem"),
    ],
    { stdio: "ignore" },
  );
  const requests = [];
  fixture = createHttpsServer(
    { key: await readFile(join(temporary, "key.pem")), cert: await readFile(join(temporary, "cert.pem")) },
    (request, response) => {
      const host = request.headers.host.split(":")[0];
      requests.push({ host, path: request.url, method: request.method, authorization: request.headers.authorization });
      if (host !== "blocked.example.com") response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, DELETE, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, X-SHA-256, X-Content-Type, X-Content-Length");
      if (host === "readable.example.com")
        response.setHeader("Access-Control-Expose-Headers", "X-Cashu, X-Lightning, Allow");
      if (host === "redirect.example.com") {
        response.writeHead(307, { Location: "https://127.0.0.1/should-not-follow" });
        response.end();
        return;
      }
      if (request.url === "/mirror") response.setHeader("Allow", "PUT, OPTIONS");
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (host === "redirect.example.com") {
        response.writeHead(307, { Location: "https://127.0.0.1/should-not-follow" });
        response.end();
        return;
      }
      if (request.url === "/upload") {
        response.writeHead(402, { "X-Cashu": "private-fixture-request", "X-Lightning": "private-fixture-invoice" });
      } else response.writeHead(200);
      response.end();
    },
  );
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const fixturePort = fixture.address().port;

  vite = await createViteServer({
    server: { host: "127.0.0.1", port: 0 },
    plugins: [
      {
        name: "report-dialog-browser-fixture",
        configureServer(server) {
          server.middlewares.use("/__probe_test__", (_request, response) => {
            response.setHeader("Content-Type", "text/html");
            response.end(
              "<!doctype html><html><head><title>Probe fixture</title></head><body>Browser integration test</body></html>",
            );
          });
          server.middlewares.use("/__report_test__", async (_request, response) => {
            response.setHeader("Content-Type", "text/html");
            response.end(
              await server.transformIndexHtml(
                "/__report_test__",
                '<!doctype html><html><head><title>Report UI fixture</title></head><body><div id="root"></div><script type="module" src="/__report_test_entry__.tsx"></script></body></html>',
              ),
            );
          });
        },
        resolveId(id) {
          if (id === "/__report_test_entry__.tsx") return id;
        },
        load(id) {
          if (id !== "/__report_test_entry__.tsx") return;
          return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { MemoryRouter } from 'react-router-dom';
          import { ExtensionAccount } from 'applesauce-accounts/accounts';
          import { ExtensionSigner } from 'applesauce-signers';
          import { ReportDialog } from '/src/components/report-dialog';
          import { accounts } from '/src/services/accounts';
          import { eventStore } from '/src/services/nostr';
          import '/src/index.css';
          eventStore.eventLoader = undefined;
          window.nostr = { getPublicKey: async () => 'a'.repeat(64), signEvent: async () => { throw new Error('No signing in UI fixture'); } };
          const account = new ExtensionAccount('a'.repeat(64), new ExtensionSigner());
          accounts.addAccount(account);
          accounts.setActive(account);
          createRoot(document.getElementById('root')).render(
            <MemoryRouter><ReportDialog url="https://readable.example.com:${fixturePort}/"><button>Open report</button></ReportDialog></MemoryRouter>
          );
        `;
        },
      },
    ],
  });
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  chrome = spawn(
    process.env.CHROME_BIN ?? "google-chrome",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--no-proxy-server",
      "--no-first-run",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      // Test-only self-signed fixture certificate. Never used by the application itself.
      "--ignore-certificate-errors",
      "--host-resolver-rules=MAP *.example.com 127.0.0.1",
      `--user-data-dir=${join(temporary, "profile")}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const debuggerUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome debugger did not start")), 15000);
    chrome.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    chrome.stderr.on("data", (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  socket = new WebSocket(debuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) call?.reject(new Error(JSON.stringify(message.error)));
      else call?.resolve(message.result);
    } else for (const listener of listeners) listener(message);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      pending.set(callId, { resolve, reject });
      socket.send(JSON.stringify({ id: callId, method, params, sessionId }));
    });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  const loaded = new Promise((resolve) => {
    const listener = (event) => {
      if (event.sessionId === sessionId && event.method === "Page.loadEventFired") {
        listeners.delete(listener);
        resolve();
      }
    };
    listeners.add(listener);
  });
  await send("Page.navigate", { url: `${origin}/__probe_test__` }, sessionId);
  await loaded;
  const evaluation = await send(
    "Runtime.evaluate",
    {
      expression: `(async () => {
      const { probeServer } = await import('/src/services/probe.ts');
      const result = {};
      for (const host of ['readable', 'hidden', 'blocked', 'redirect']) {
        result[host] = await probeServer('https://' + host + '.example.com:${fixturePort}/', { timeout: 3000 });
      }
      return result;
    })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  assert.equal(evaluation.exceptionDetails, undefined, JSON.stringify(evaluation.exceptionDetails));
  const result = evaluation.result.value;
  assert.equal(result.readable[1].status, 402);
  assert.deepEqual(result.readable[1].payments, ["cashu", "lightning"]);
  assert.equal(result.readable[2].status, 200);
  assert.equal(result.hidden[1].status, 402);
  assert.deepEqual(result.hidden[1].payments, []);
  assert.deepEqual(result.readable[3].allow, ["PUT", "OPTIONS"]);
  assert.equal(result.hidden[3].allow, undefined);
  assert.ok(result.blocked.every((entry) => entry.failure === "network-or-cors" && entry.status === undefined));
  assert.ok(result.redirect.every((entry) => entry.failure === "network-or-cors"));
  assert.ok(requests.some((request) => request.method === "OPTIONS"));
  assert.ok(requests.every((request) => ["GET", "HEAD", "OPTIONS"].includes(request.method) && !request.authorization));
  assert.ok(!JSON.stringify(result).includes("private-fixture"));
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width: 1100, height: 950, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await send("Page.navigate", { url: `${origin}/__report_test__` }, sessionId);
  const ui = await send(
    "Runtime.evaluate",
    {
      expression: `(async () => {
      const wait = async (predicate) => {
        for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
        throw new Error('UI fixture condition timed out: ' + document.body.innerText);
      };
      await wait(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Open report'));
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Open report').click();
      await wait(() => document.querySelector('[role="dialog"]'));
      const dialog = document.querySelector('[role="dialog"]');
      const refresh = [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Refresh');
      if (!refresh) throw new Error('Missing single Refresh action');
      refresh.click();
      await wait(() => dialog.innerText.includes('4 server responses captured'));
      return {
        width: dialog.getBoundingClientRect().width,
        text: dialog.innerText,
        selections: [...dialog.querySelectorAll('select')].map(select => select.value),
        rawHidden: !dialog.innerText.includes('"schema"') && !dialog.innerText.includes('"endpoint"'),
      };
    })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  assert.equal(ui.exceptionDetails, undefined, JSON.stringify(ui.exceptionDetails));
  assert.equal(ui.result.value.width, 840);
  assert.ok(ui.result.value.text.includes("Payment requested · cashu, lightning"));
  assert.ok(ui.result.value.text.includes("Advertised by this endpoint"));
  assert.ok(!ui.result.value.text.includes("HTTP 402"));
  assert.ok(ui.result.value.selections.every((value) => value === "unknown"));
  assert.equal(ui.result.value.rawHidden, true);
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
    sessionId,
  );
  const mobile = await send(
    "Runtime.evaluate",
    {
      expression: `({ width: document.querySelector('[role="dialog"]').getBoundingClientRect().width, viewport: innerWidth, scroll: document.querySelector('[role="dialog"]').scrollWidth })`,
      returnByValue: true,
    },
    sessionId,
  );
  assert.ok(mobile.result.value.width <= mobile.result.value.viewport - 30);
  assert.ok(mobile.result.value.scroll <= mobile.result.value.width);
  console.log(
    "Browser probes and report UI passed: CORS/header exposure, safe requests, 840px dialog, mobile fit, one Refresh action, collapsed technical data and separate detected hints.",
  );
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    const stopped = once(chrome, "exit");
    chrome.kill("SIGKILL");
    await stopped;
  }
  await vite?.close();
  if (fixture) {
    fixture.closeAllConnections();
    await new Promise((resolve) => fixture.close(resolve));
  }
  await rm(temporary, { recursive: true, force: true });
}
