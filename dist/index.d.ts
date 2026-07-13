import { EventEmitter } from 'node:events';

declare const OPCODE_HANDSHAKE = 0;
declare const OPCODE_FRAME = 1;
declare const OPCODE_CLOSE = 2;
declare const OPCODE_PING = 3;
declare const OPCODE_PONG = 4;
declare const MAX_IPC_SLOTS = 10;
type RpcActivityType = "playing" | "listening";
type RpcActivity = {
    name: string;
    details?: string;
    state?: string;
    type?: RpcActivityType;
    applicationId?: string;
    timestamps?: {
        start?: number;
        end?: number;
    };
};
type SetActivityArgs = {
    pid?: number;
    activity: RpcActivity | null;
};
type RpcFrame = {
    cmd?: string;
    nonce?: string;
    data?: unknown;
    args?: Record<string, unknown>;
};
declare function pipePath(slot: number): string;
declare function encodeFrame(opcode: number, payload: object): Buffer;
declare class FrameReader {
    private buffer;
    push(chunk: Buffer): Array<{
        opcode: number;
        message: unknown;
    }>;
}

type MutualzzRpcOptions = {
    clientId: string;
    protocolVersion?: number;
    connectTimeoutMs?: number;
    path?: string;
};
declare class MutualzzRpc extends EventEmitter {
    private readonly clientId;
    private readonly protocolVersion;
    private readonly connectTimeoutMs;
    private readonly preferredPath;
    private socket;
    private boundPath;
    private reader;
    private ready;
    private pending;
    constructor(options: MutualzzRpcOptions);
    get isConnected(): boolean;
    get path(): string | null;
    connect(): Promise<string>;
    setActivity(activity: RpcActivity | null, opts?: {
        pid?: number;
    }): Promise<RpcActivity | null>;
    clearActivity(opts?: {
        pid?: number;
    }): Promise<RpcActivity | null>;
    disconnect(): void;
    private ensureConnected;
    private connectPath;
    private openSocket;
    private handshake;
    private request;
    private handleFrame;
    private write;
    private rejectAll;
}

export { FrameReader, MAX_IPC_SLOTS, MutualzzRpc, OPCODE_CLOSE, OPCODE_FRAME, OPCODE_HANDSHAKE, OPCODE_PING, OPCODE_PONG, encodeFrame, pipePath };
export type { MutualzzRpcOptions, RpcActivity, RpcActivityType, RpcFrame, SetActivityArgs };
