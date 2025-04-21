// src/stores/usePoolPriceState.ts
import { defineStore } from "pinia";
import type { ChainsState, ChainInfo } from "../interfaces/pool_Interface";
import { CHAINS } from "../config/chains";

export const usePoolPriceState = defineStore("poolPrice", {
  state: (): ChainsState => {
    const initialChains = CHAINS.reduce(
      (acc, { chainId, chainName, rpcUrl }) => {
        acc[chainId] = {
          chainId,
          chainName,
          rpcUrl,
          tokens: {},
        } as ChainInfo;
        return acc;
      },
      {} as Record<number, ChainInfo>
    );

    return { chains: initialChains, selectedChainId: CHAINS[0]?.chainId ?? 0 };
  },

  getters: {
    allChains: (state): ChainInfo[] => {
      return Object.values(state.chains);
    },
    currentChain: (state) => state.chains[state.selectedChainId],
    currentRpcUrl: (state): string =>
      state.chains[state.selectedChainId]?.rpcUrl ?? "",
  },

  actions: {
    setSelectedChain(id: number) {
      this.selectedChainId = id;
    },

    // 1) 체인 등록 (최초)
    ensureChain(chainId: number, chainName: string, rpc: string) {
      if (!this.chains[chainId]) {
        this.chains[chainId] = { chainId, chainName, rpcUrl: rpc, tokens: {} };
      }
    },

    // 2) 토큰 등록
    ensureToken(chainId: number, tokenAddress: string) {
      //   this.ensureChain(chainId, ""); <- 현재는 체인이 허용되거나 따로 등록한 상태에서만 가능
      const tokens = this.chains[chainId].tokens;
      if (!tokens[tokenAddress]) {
        tokens[tokenAddress] = { tokenAddress, pools: {} };
      }
    },

    // 3) 풀 등록
    ensurePool(chainId: number, tokenAddress: string, poolId: string) {
      this.ensureToken(chainId, tokenAddress);
      const pools = this.chains[chainId].tokens[tokenAddress].pools;
      if (!pools[poolId]) {
        pools[poolId] = {
          poolId,
          dates: [],
          values: [],
          types: [],
          txs: [],
          infos: [],
          beforePrice: 0,
        };
      }
    },

    // 4) 하나의 캔들(트랜잭션) 추가
    addCandle(
      chainId: number,
      tokenAddress: string,
      poolId: string,
      data: [string, [number, number, number, number], string, any],
      info: any
    ) {
      this.ensurePool(chainId, tokenAddress, poolId);
      const poolState = this.chains[chainId].tokens[tokenAddress].pools[poolId];
      poolState.dates.push(data[0]);
      poolState.values.push(data[1]);
      poolState.types.push(data[2]);
      poolState.txs.push(data[3]);
      poolState.infos.push(info);
    },
  },
});
