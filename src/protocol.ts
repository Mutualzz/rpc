export const OPCODE_HANDSHAKE = 0;
export const OPCODE_FRAME = 1;
export const OPCODE_CLOSE = 2;
export const OPCODE_PING = 3;
export const OPCODE_PONG = 4;

export const MAX_IPC_SLOTS = 10;

export type RpcActivityType = "playing" | "listening";

export type RpcActivityAssets = {
  largeImageUrl?: string;
  largeText?: string;
  smallImageUrl?: string;
  smallText?: string;
};

export type RpcActivity = {
  name: string;
  details?: string;
  state?: string;
  type?: RpcActivityType;
  applicationId?: string;
  url?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: RpcActivityAssets;
};

export type SetActivityArgs = {
  pid?: number;
  activity: RpcActivity | null;
};

export type RpcFrame = {
  cmd?: string;
  nonce?: string;
  data?: unknown;
  args?: Record<string, unknown>;
};

export function pipePath(slot: number): string {
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\mutualzz-ipc-${slot}`;
  }
  return `/tmp/mutualzz-ipc-${slot}`;
}

export function encodeFrame(opcode: number, payload: object): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode >>> 0, 0);
  header.writeUInt32LE(body.length >>> 0, 4);
  return Buffer.concat([header, body]);
}

export class FrameReader {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): Array<{ opcode: number; message: unknown }> {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: Array<{ opcode: number; message: unknown }> = [];

    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const length = this.buffer.readUInt32LE(4);
      if (this.buffer.length < 8 + length) break;

      const raw = this.buffer.subarray(8, 8 + length).toString("utf8");
      this.buffer = this.buffer.subarray(8 + length);

      try {
        frames.push({ opcode, message: JSON.parse(raw) });
      } catch {
        continue;
      }
    }

    return frames;
  }
}
