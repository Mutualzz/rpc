# `@mutualzz/rpc`

Node.js helper for Mutualzz desktop presence over local IPC.

Requires the **Mutualzz desktop app** to be running. This is Mutualzz-owned IPC — not Discord RPC.

## Install

```bash
npm install @mutualzz/rpc
```

```bash
pnpm add @mutualzz/rpc
```

From this monorepo:

```bash
pnpm --filter @mutualzz/rpc build
```

## Quick start

```ts
import { MutualzzRpc } from "@mutualzz/rpc";

const rpc = new MutualzzRpc({
  clientId: "your-app-id",
});

await rpc.connect();

await rpc.setActivity({
  name: "My Game",
  details: "Ranked",
  state: "In a Match",
  type: "playing",
  timestamps: { start: Date.now() },
});

process.on("SIGINT", () => {
  rpc.disconnect();
  process.exit(0);
});
```

Keep the process (and socket) alive while the activity should show. Disconnecting or exiting clears presence.

## API

### `new MutualzzRpc({ clientId, connectTimeoutMs?, path? })`

| Option | Type | Description |
|--------|------|-------------|
| `clientId` | `string` | Required. Sent on handshake; used as `applicationId` for icons when it matches the Mutualzz game catalog |
| `connectTimeoutMs` | `number` | Default `5000` |
| `path` | `string` | Optional. Connect to a specific pipe/socket instead of scanning `0`–`9` |

### `connect(): Promise<string>`

Connects to the first available Mutualzz IPC endpoint and completes handshake. Resolves with the bound path.

### `setActivity(activity, opts?): Promise<RpcActivity | null>`

```ts
await rpc.setActivity({
  name: "My Game",
  details?: string,
  state?: string,
  type?: "playing" | "listening",
  applicationId?: string,
  timestamps?: { start?: number; end?: number },
}, { pid?: number });
```

Pass `null` (or call `clearActivity()`) to clear.

### `clearActivity(opts?)`

### `disconnect()`

Closes the socket. Presence clears on the Mutualzz client.

### Events

- `ready` — handshake finished
- `close` — socket closed
- `error` — socket error

## IPC endpoints

| Platform | Paths |
|----------|--------|
| Windows | `\\.\pipe\mutualzz-ipc-0` … `mutualzz-ipc-9` |
| Linux / macOS | `/tmp/mutualzz-ipc-0` … `mutualzz-ipc-9` |

The helper tries slots `0`–`9` automatically.

## Protocol

See [PROTOCOL.md](https://github.com/Mutualzz/mutualzz/blob/master/packages/rpc/PROTOCOL.md) for the shared wire format used by all language wrappers.

## Other languages

| Package | Language |
|---------|----------|
| [`packages/rpc`](https://github.com/Mutualzz/mutualzz/tree/master/packages/rpc) | Node.js (`@mutualzz/rpc`) |
| [`packages/rpc-cpp`](https://github.com/Mutualzz/mutualzz/tree/master/packages/rpc-cpp) | C++ |
| [`packages/rpc-csharp`](https://github.com/Mutualzz/mutualzz/tree/master/packages/rpc-csharp) | C# / .NET |

## Example CLI

```bash
node apps/app/scripts/rpc-test-client.mjs --name="My Game" --details="Ranked"
```

Ctrl+C disconnects and clears.
