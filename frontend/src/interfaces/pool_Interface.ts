// 1) 한 건의 캔들(트랜잭션) 정보
export interface ChainInfo {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  logo?: string;
  tokens: Record<string, TokenData>;
}

export interface payment {
  keyType: string;
  account: string;
  fee: number;
  sendAmount: number;
  deliveredAmount: number;
}

export interface transfer {
  keyType: string;
  account: string;
  fee: number;
  deliveredAmount: string;
  Destination: string;
}

export interface Candle {}

// 2) 풀 하나가 가진 캔들들의 배열
export interface PoolData {
  poolId: string; // 예: "XRP", "USD_rXYZ…"
  beforePrice: number;
  dates: string[];
  values: [number, number, number, number][];
  types: string[];
  txs: any[];
  infos: (payment | transfer)[];
}

// 3) 토큰(발행자) 하나가 가진 여러 풀
export interface TokenData {
  tokenAddress: string; // 사용자가 검색한 토큰 주소
  pools: Record<string, PoolData>;
  // Record 키(poolId) → PoolData
}

// 4) 체인 하나가 가진 여러 토큰
export interface ChainData {
  chainId: number; // config/chains.ts 의 id
  chainName: string; // 가독성용
  tokens: Record<string, TokenData>;
  // Record 키(tokenAddress) → TokenData
}

// store/state.ts
export interface ChainsState {
  chains: Record<number, ChainInfo>;
  selectedChainId: number;
}
