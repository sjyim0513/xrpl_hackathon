import { reactive } from "vue";
import type { PoolState } from "../interfaces/transaction_interface";

const state = reactive<Record<string, PoolState>>({});

export function usePoolPriceState() {
  // 풀 초기화: 해당 poolId가 없으면 초기값 설정
  function initializePool(poolId: string) {
    if (!(poolId in state)) {
      state[poolId] = {
        beforeprice: 0,
        categoryDate: [],
        values: [],
        type: [],
        tx: [],
        info: [],
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
  function addPoolData(
    poolId: string,
    data: [string, any, string, any],
    info: any
  ) {
    initializePool(poolId);

    state[poolId].categoryDate.push(data[0]);
    state[poolId].values.push(data[1]);
    state[poolId].type.push(data[2]);
    state[poolId].tx.push(data[3]);
    state[poolId].info.push(info);
  }

  function addtoAllPoolDatas(data: [string, string, any], info: any) {
    Object.keys(state).forEach((poolId) => {
      const beforePrice = getBeforePrice(poolId);
      const value = [beforePrice, beforePrice, beforePrice, beforePrice];
      state[poolId].categoryDate.push(data[0]);
      state[poolId].values.push(value);
      state[poolId].type.push(data[1]);
      state[poolId].tx.push(data[2]);
      state[poolId].info.push(info);
      // 결과 배열: 첫 번째는 data[0], 두 번째는 value, 세 번째는 data[1], 네 번째는 data[2], 마지막은 info
    });
  }

  // 필요시 해당 풀의 poolData를 가져오는 함수
  function getPoolData(poolId: string) {
    console.log(state);
    return state[poolId];
  }

  function getValues(poolId: string) {
    return state[poolId].values;
  }

  function getDates(poolId: string) {
    return state[poolId].categoryDate;
  }

  function getTypes(poolId: string) {
    return state[poolId].type;
  }

  function getTxs(poolId: string) {
    return state[poolId].tx;
  }

  function getInfos(poolId: string) {
    return state[poolId].info;
  }

  return {
    state,
    getBeforePrice,
    setBeforePrice,
    addPoolData,
    addtoAllPoolDatas,
    getPoolData,
    getValues,
    getDates,
    getTypes,
    getTxs,
    getInfos,
  };
}
