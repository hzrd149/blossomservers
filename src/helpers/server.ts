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

/** Normalizes a server URL, returning null when it is invalid */
export function safeNormalizeServerUrl(input: string | URL | undefined): string | null {
  if (!input) return null;
  try {
    return normalizeServerUrl(input.toString());
  } catch {
    return null;
  }
}

export function isValidServerUrl(input: string): boolean {
  return safeNormalizeServerUrl(input) !== null;
}

/** Returns the host of a normalized server URL for display and routing */
export function getServerHost(url: string): string {
  return new URL(url).host;
}

/** Builds the app route for a server */
export function getServerPath(url: string): string {
  // Preserve existing HTTPS host links; don't silently route legacy HTTP entries to HTTPS.
  return `/server/${new URL(url).protocol === "https:" ? getServerHost(url) : encodeURIComponent(url)}`;
}
