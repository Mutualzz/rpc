# Mutualzz RPC protocol

Shared wire protocol for Mutualzz desktop Rich Presence IPC.
Language wrappers: `@mutualzz/rpc` (Node), `rpc-cpp`, `rpc-csharp`.

Requires the Mutualzz desktop app to be running.

## Endpoints

Try slots `0`–`9` until one connects.

| Platform | Path |
|----------|------|
| Windows | `\\.\pipe\mutualzz-ipc-N` |
| Linux / macOS | `/tmp/mutualzz-ipc-N` |

## Frame format

Every message:

```
[opcode: uint32 little-endian]
[length: uint32 little-endian]
[payload: UTF-8 JSON, `length` bytes]
```

Write the full frame as one buffer.

| Opcode | Name | Direction |
|--------|------|-----------|
| `0` | Handshake | Client → Host |
| `1` | Frame | Both |
| `2` | Close | Both |
| `3` | Ping | Either |
| `4` | Pong | Reply to Ping |

## Handshake

Client sends opcode `0`:

```json
{ "clientId": "your-app-id" }
```

Host replies opcode `1`:

```json
{ "cmd": "READY" }
```

`clientId` becomes the activity `applicationId` when the activity does not set one.

## SET_ACTIVITY

Client sends opcode `1`:

```json
{
  "cmd": "SET_ACTIVITY",
  "nonce": "unique-string",
  "args": {
    "pid": 12345,
    "activity": {
      "name": "My Game",
      "details": "Ranked",
      "state": "In a Match",
      "type": "playing",
      "applicationId": "optional-override",
      "url": "https://open.spotify.com/track/...",
      "timestamps": { "start": 1710000000000, "end": 1710003600000 },
      "assets": {
        "largeImageUrl": "https://i.scdn.co/image/...",
        "largeText": "Album name"
      }
    }
  }
}
```

Clear presence:

```json
{
  "cmd": "SET_ACTIVITY",
  "nonce": "unique-string",
  "args": { "pid": 12345, "activity": null }
}
```

`type` is `"playing"` (default) or `"listening"`.

Host echoes:

```json
{
  "cmd": "SET_ACTIVITY",
  "nonce": "same-nonce",
  "data": { "...activity or null..." }
}
```

## Lifecycle

1. Connect to a free IPC endpoint
2. Handshake → wait for `READY`
3. `SET_ACTIVITY` when state changes
4. Keep the connection open while presence should show
5. Clear with `activity: null`, send Close, or disconnect (disconnect clears)

## Ping / Pong

If you receive opcode `3`, reply opcode `4` with the same JSON payload (or `{}`).
