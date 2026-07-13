export { MutualzzRpc, type MutualzzRpcOptions } from "./client";
export {
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
  type RpcActivityType,
  type RpcFrame,
  type SetActivityArgs,
} from "./protocol";
