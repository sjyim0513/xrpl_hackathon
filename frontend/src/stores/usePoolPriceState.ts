import { reactive } from "vue";
import type { PoolState } from "../interfaces/transaction_interface";

const state = reactive<Record<string, PoolState>>({});

export function usePoolPriceState() {
  // 풀 초기화: 해당 poolId가 없으면 초기값 설정
  function initializePool(poolId: string) {
    if (!(poolId in state)) {
      state[poolId] = {
        beforeprice: 1,
        poolData: [],
      };
    }
  }

  // 해당 풀의 beforeprice를 가져옴
  function getBeforePrice(poolId: string): number {
    initializePool(poolId);
    return state[poolId].beforeprice;
  }

  // 해당 풀의 beforeprice를 업데이트함
  function setBeforePrice(poolId: string, newValue: number) {
    initializePool(poolId);
    state[poolId].beforeprice = newValue;
  }

  // 해당 풀에 새로운 데이터를 추가함
  function addPoolData(poolId: string, data: [string, any, string, any]) {
    initializePool(poolId);
    state[poolId].poolData.push(data);
  }

  // 필요시 해당 풀의 poolData를 가져오는 함수
  function getPoolData(poolId: string): Array<[string, any, string, any]> {
    initializePool(poolId);
    if (poolId === "all") {
      console.log(state);
    }
    return state[poolId].poolData;
  }

  return { state, getBeforePrice, setBeforePrice, addPoolData, getPoolData };
}
