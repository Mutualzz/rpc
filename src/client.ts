import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import net from "node:net";
import {
  FrameReader,
  MAX_IPC_SLOTS,
  OPCODE_CLOSE,
  OPCODE_FRAME,
  OPCODE_HANDSHAKE,
  OPCODE_PING,
  OPCODE_PONG,
  encodeFrame,
  pipePath,
  type RpcActivity,
  type RpcFrame,
  type SetActivityArgs,
} from "./protocol";

export type MutualzzRpcOptions = {
  clientId: string;
  connectTimeoutMs?: number;
  path?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class MutualzzRpc extends EventEmitter {
  private readonly clientId: string;
  private readonly connectTimeoutMs: number;
  private readonly preferredPath: string | null;

  private socket: net.Socket | null = null;
  private boundPath: string | null = null;
  private reader = new FrameReader();
  private ready = false;
  private pending = new Map<string, PendingRequest>();

  constructor(options: MutualzzRpcOptions) {
    super();

    const clientId = options.clientId?.trim();
    if (!clientId) throw new Error("clientId is required");

    this.clientId = clientId;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.preferredPath = options.path?.trim() || null;
  }

  get isConnected() {
    return !!this.socket && !this.socket.destroyed && this.ready;
  }

  get path() {
    return this.boundPath;
  }

  async connect(): Promise<string> {
    if (this.isConnected && this.boundPath) return this.boundPath;

    this.disconnect();

    const { socket, path } = await this.openSocket();
    this.socket = socket;
    this.boundPath = path;
    this.reader = new FrameReader();

    socket.on("data", (chunk: Buffer) => {
      for (const frame of this.reader.push(chunk)) {
        this.handleFrame(frame.opcode, frame.message);
      }
    });

    socket.on("error", (err) => {
      this.emit("error", err);
    });

    socket.on("close", () => {
      this.rejectAll(new Error("Mutualzz RPC connection closed"));
      this.ready = false;
      this.socket = null;
      this.emit("close");
    });

    await this.handshake();
    this.ready = true;
    this.emit("ready");
    return path;
  }

  async setActivity(
    activity: RpcActivity | null,
    opts?: { pid?: number },
  ): Promise<RpcActivity | null> {
    await this.ensureConnected();

    const args: SetActivityArgs = {
      pid: opts?.pid ?? process.pid,
      activity,
    };

    const data = await this.request("SET_ACTIVITY", args);
    return (data as RpcActivity | null) ?? null;
  }

  async clearActivity(opts?: { pid?: number }) {
    return this.setActivity(null, opts);
  }

  disconnect() {
    const socket = this.socket;
    this.socket = null;
    this.boundPath = null;
    this.ready = false;
    this.rejectAll(new Error("Mutualzz RPC disconnected"));

    if (!socket || socket.destroyed) return;

    try {
      socket.write(encodeFrame(OPCODE_CLOSE, {}));
    } catch {}

    socket.destroy();
  }

  private async ensureConnected() {
    if (!this.isConnected) await this.connect();
  }

  private connectPath(path: string) {
    return new Promise<net.Socket>((resolve, reject) => {
      const socket = net.createConnection(path);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Timed out connecting to ${path}`));
      }, this.connectTimeoutMs);

      const onError = (err: Error) => {
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      };

      socket.once("error", onError);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.off("error", onError);
        resolve(socket);
      });
    });
  }

  private async openSocket(): Promise<{ socket: net.Socket; path: string }> {
    if (this.preferredPath) {
      const socket = await this.connectPath(this.preferredPath);
      return { socket, path: this.preferredPath };
    }

    for (let slot = 0; slot < MAX_IPC_SLOTS; slot++) {
      const path = pipePath(slot);
      try {
        const socket = await this.connectPath(path);
        return { socket, path };
      } catch {
        continue;
      }
    }

    throw new Error(
      "No Mutualzz RPC pipe found (is the Mutualzz desktop app running?)",
    );
  }

  private handshake() {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for Mutualzz RPC READY"));
      }, this.connectTimeoutMs);

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onClose = () => {
        cleanup();
        reject(new Error("Connection closed before READY"));
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.off("internal-ready", onReady);
        this.off("error", onError);
        this.off("close", onClose);
      };

      this.once("internal-ready", onReady);
      this.once("error", onError);
      this.once("close", onClose);

      this.write(OPCODE_HANDSHAKE, {
        clientId: this.clientId,
      });
    });
  }

  private request(cmd: string, args: object) {
    const nonce = randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error(`Timed out waiting for ${cmd} response`));
      }, this.connectTimeoutMs);

      this.pending.set(nonce, { resolve, reject, timer });
      this.write(OPCODE_FRAME, { cmd, args, nonce });
    });
  }

  private handleFrame(opcode: number, message: unknown) {
    if (opcode === OPCODE_PONG) return;

    if (opcode === OPCODE_PING) {
      this.write(OPCODE_PONG, (message as object) ?? {});
      return;
    }

    if (opcode === OPCODE_CLOSE) {
      this.disconnect();
      return;
    }

    if (opcode !== OPCODE_FRAME || !message || typeof message !== "object") {
      return;
    }

    const frame = message as RpcFrame;

    if (frame.cmd === "READY") {
      this.emit("internal-ready");
      return;
    }

    if (!frame.nonce) return;

    const pending = this.pending.get(frame.nonce);
    if (!pending) return;

    this.pending.delete(frame.nonce);
    clearTimeout(pending.timer);
    pending.resolve(frame.data ?? null);
  }

  private write(opcode: number, payload: object) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Mutualzz RPC socket is not connected");
    }

    this.socket.write(encodeFrame(opcode, payload));
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
