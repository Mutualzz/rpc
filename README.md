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

Requires the Mutualzz desktop app to be running.

From this monorepo:

```bash
pnpm --filter @mutualzz/rpc build
```

## Publish

```bash
pnpm --filter @mutualzz/rpc publish --access public
```

`prepublishOnly` builds `dist/` before publish.

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

### `new MutualzzRpc({ clientId, protocolVersion?, connectTimeoutMs?, path? })`

| Option | Type | Description |
|--------|------|-------------|
| `clientId` | `string` | Required. Sent on handshake; used as `applicationId` for icons when it matches the Mutualzz game catalog |
| `protocolVersion` | `number` | Default `1` |
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

Frames:

```
[opcode: u32 LE][length: u32 LE][utf8 JSON]
```

| Opcode | Meaning |
|--------|---------|
| `0` | Handshake |
| `1` | Frame |
| `2` | Close |
| `3` / `4` | Ping / Pong |

Handshake:

```json
{ "v": 1, "clientId": "your-app-id" }
```

Ready:

```json
{ "cmd": "READY", "data": { "v": 1 } }
```

Set activity:

```json
{
  "cmd": "SET_ACTIVITY",
  "nonce": "uuid",
  "args": {
    "pid": 12345,
    "activity": {
      "name": "My Game",
      "details": "Ranked",
      "state": "In a Match",
      "type": "playing",
      "timestamps": { "start": 1710000000000 }
    }
  }
}
```

Clear with `"activity": null`.

Low-level helpers (`encodeFrame`, `pipePath`, opcodes) are also exported.

## Example CLI

```bash
node apps/app/scripts/rpc-test-client.mjs --name="My Game" --details="Ranked"
```

Ctrl+C disconnects and clears.
