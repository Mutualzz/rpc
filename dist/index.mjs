import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import net from 'node:net';

const OPCODE_HANDSHAKE = 0;
const OPCODE_FRAME = 1;
const OPCODE_CLOSE = 2;
const OPCODE_PING = 3;
const OPCODE_PONG = 4;
const MAX_IPC_SLOTS = 10;
function pipePath(slot) {
    if (process.platform === "win32") {
        return `\\\\.\\pipe\\mutualzz-ipc-${slot}`;
    }
    return `/tmp/mutualzz-ipc-${slot}`;
}
function encodeFrame(opcode, payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const header = Buffer.alloc(8);
    header.writeUInt32LE(opcode >>> 0, 0);
    header.writeUInt32LE(body.length >>> 0, 4);
    return Buffer.concat([
        header,
        body
    ]);
}
class FrameReader {
    push(chunk) {
        this.buffer = Buffer.concat([
            this.buffer,
            chunk
        ]);
        const frames = [];
        while(this.buffer.length >= 8){
            const opcode = this.buffer.readUInt32LE(0);
            const length = this.buffer.readUInt32LE(4);
            if (this.buffer.length < 8 + length) break;
            const raw = this.buffer.subarray(8, 8 + length).toString("utf8");
            this.buffer = this.buffer.subarray(8 + length);
            try {
                frames.push({
                    opcode,
                    message: JSON.parse(raw)
                });
            } catch  {
                continue;
            }
        }
        return frames;
    }
    constructor(){
        this.buffer = Buffer.alloc(0);
    }
}

class MutualzzRpc extends EventEmitter {
    constructor(options){
        super(), this.socket = null, this.boundPath = null, this.reader = new FrameReader(), this.ready = false, this.pending = new Map();
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
    async connect() {
        if (this.isConnected && this.boundPath) return this.boundPath;
        this.disconnect();
        const { socket, path } = await this.openSocket();
        this.socket = socket;
        this.boundPath = path;
        this.reader = new FrameReader();
        socket.on("data", (chunk)=>{
            for (const frame of this.reader.push(chunk)){
                this.handleFrame(frame.opcode, frame.message);
            }
        });
        socket.on("error", (err)=>{
            this.emit("error", err);
        });
        socket.on("close", ()=>{
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
    async setActivity(activity, opts) {
        await this.ensureConnected();
        const args = {
            pid: opts?.pid ?? process.pid,
            activity
        };
        const data = await this.request("SET_ACTIVITY", args);
        return data ?? null;
    }
    async clearActivity(opts) {
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
        } catch  {}
        socket.destroy();
    }
    async ensureConnected() {
        if (!this.isConnected) await this.connect();
    }
    connectPath(path) {
        return new Promise((resolve, reject)=>{
            const socket = net.createConnection(path);
            const timer = setTimeout(()=>{
                socket.destroy();
                reject(new Error(`Timed out connecting to ${path}`));
            }, this.connectTimeoutMs);
            const onError = (err)=>{
                clearTimeout(timer);
                socket.destroy();
                reject(err);
            };
            socket.once("error", onError);
            socket.once("connect", ()=>{
                clearTimeout(timer);
                socket.off("error", onError);
                resolve(socket);
            });
        });
    }
    async openSocket() {
        if (this.preferredPath) {
            const socket = await this.connectPath(this.preferredPath);
            return {
                socket,
                path: this.preferredPath
            };
        }
        for(let slot = 0; slot < MAX_IPC_SLOTS; slot++){
            const path = pipePath(slot);
            try {
                const socket = await this.connectPath(path);
                return {
                    socket,
                    path
                };
            } catch  {
                continue;
            }
        }
        throw new Error("No Mutualzz RPC pipe found (is the Mutualzz desktop app running?)");
    }
    handshake() {
        return new Promise((resolve, reject)=>{
            const timer = setTimeout(()=>{
                cleanup();
                reject(new Error("Timed out waiting for Mutualzz RPC READY"));
            }, this.connectTimeoutMs);
            const onReady = ()=>{
                cleanup();
                resolve();
            };
            const onError = (err)=>{
                cleanup();
                reject(err);
            };
            const onClose = ()=>{
                cleanup();
                reject(new Error("Connection closed before READY"));
            };
            const cleanup = ()=>{
                clearTimeout(timer);
                this.off("internal-ready", onReady);
                this.off("error", onError);
                this.off("close", onClose);
            };
            this.once("internal-ready", onReady);
            this.once("error", onError);
            this.once("close", onClose);
            this.write(OPCODE_HANDSHAKE, {
                clientId: this.clientId
            });
        });
    }
    request(cmd, args) {
        const nonce = randomUUID();
        return new Promise((resolve, reject)=>{
            const timer = setTimeout(()=>{
                this.pending.delete(nonce);
                reject(new Error(`Timed out waiting for ${cmd} response`));
            }, this.connectTimeoutMs);
            this.pending.set(nonce, {
                resolve,
                reject,
                timer
            });
            this.write(OPCODE_FRAME, {
                cmd,
                args,
                nonce
            });
        });
    }
    handleFrame(opcode, message) {
        if (opcode === OPCODE_PONG) return;
        if (opcode === OPCODE_PING) {
            this.write(OPCODE_PONG, message ?? {});
            return;
        }
        if (opcode === OPCODE_CLOSE) {
            this.disconnect();
            return;
        }
        if (opcode !== OPCODE_FRAME || !message || typeof message !== "object") {
            return;
        }
        const frame = message;
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
    write(opcode, payload) {
        if (!this.socket || this.socket.destroyed) {
            throw new Error("Mutualzz RPC socket is not connected");
        }
        this.socket.write(encodeFrame(opcode, payload));
    }
    rejectAll(error) {
        for (const pending of this.pending.values()){
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }
}

export { FrameReader, MAX_IPC_SLOTS, MutualzzRpc, OPCODE_CLOSE, OPCODE_FRAME, OPCODE_HANDSHAKE, OPCODE_PING, OPCODE_PONG, encodeFrame, pipePath };
