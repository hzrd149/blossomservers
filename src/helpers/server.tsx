import { getTagValue, NostrEvent } from "applesauce-core/helpers";

export function isServerWhitelist(server: NostrEvent): string | boolean {
  return server.tags.some((t) => t[0] === "whitelist") && (getTagValue(server, "whitelist") || true);
}
export function isServerPaid(server: NostrEvent): string | boolean {
  return server.tags.some((t) => t[0] === "paid") && (getTagValue(server, "paid") || true);
}

export function normalizeServerUrl(input: string): string {
  let urlStr = input.trim();

  if (!urlStr) {
    throw new Error("Empty URL");
  }

  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    urlStr = "https://" + urlStr;
  }

  const url = new URL(urlStr);

  if (!url.hostname) {
    throw new Error("Invalid URL: no hostname");
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.startsWith("127.")) {
    throw new Error("Localhost URLs not allowed");
  }

  const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(hostname)) {
    throw new Error("IP addresses not allowed");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.toString();
}

export function isValidServerUrl(input: string): boolean {
  try {
    normalizeServerUrl(input);
    return true;
  } catch {
    return false;
  }
}
