import { xrplModule, type ChainModule as XrplCM } from "./xrpl";
import { solModule, type ChainModule as solCM } from "./solana";
// import { ethereumModule, ChainModule as EthCM } from "./ethereum";
// import { bscModule, ChainModule as BscCM } from "./bsc";

export type ChainModule = XrplCM & solCM;

// id 는 config/chains.ts 에 선언한 id 와 매칭
export const chainModules: Record<number, ChainModule> = {
  1440002: xrplModule, // XRPL EVM sidechain
  101: solModule,
  // 1: ethereumModule,
  // 56: bscModule,
};
