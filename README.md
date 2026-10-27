# blossomservers.com

A community directory for discovering and reviewing public [Blossom](https://github.com/hzrd149/blossom) file-storage servers.

**Use the app:** [blossomservers.com](https://blossomservers.com)

Browse servers and reviews without an account. Sign in with a Nostr browser extension, bunker URL, or QR-code signer to write reviews, comment, and manage your server list.

Server details are attributed community reports, not proof of operator ownership. See the
[experimental capability report protocol](docs/server-reports.md) for event shape, browser checks and compatibility.

## Development

Built with React, TypeScript, Vite, Tailwind CSS, and the Applesauce Nostr SDK. The app runs in the browser and reads and publishes data through Nostr relays; no application backend is required.

Use Node.js 24 (matching CI) and pnpm (the version is pinned in `package.json`).

```sh
git clone https://github.com/hzrd149/blossomservers.git
cd blossomservers
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Default relay settings live in `src/const.ts`.

Open **Settings** from the header to customize app relays, lookup relays, and appearance.
App relays are saved on this device and used for both reading and publishing. When signed in,
the app also reads from your NIP-65 read relays and publishes to your outboxes.
Your existing lookup-relay list (kind 10086) takes precedence over local lookup settings;
saving edits updates that public list only if one already exists. Otherwise, edits stay local.

### Common commands

```sh
pnpm test      # Run unit tests
pnpm build     # Type-check and build to dist/
pnpm preview   # Serve the production build locally (run build first)
pnpm format    # Format the repository with Prettier
```

UI components and pages live in `src/components/` and `src/views/`; Nostr integration lives in `src/services/`. Tests are in `tests/`.

## Deployment

Deploy `dist/` to a static host after running `pnpm build`. Configure the host to serve `index.html` for client-side routes. GitHub Pages deployment is configured in `.github/workflows/pages.yml`.

## Contributing

Bug reports and pull requests are welcome. Keep changes focused and run `pnpm test` and `pnpm build` before submitting.

## License

[MIT](LICENSE)
