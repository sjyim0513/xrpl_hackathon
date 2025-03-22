import { reactive } from "vue";
import type {
  PoolState,
  OfferState,
} from "../interfaces/transaction_interface";

const state = reactive<Record<string, PoolState>>({});

const ReactiveOfferState = reactive<Record<string, OfferState>>({});

const tokenMaps = reactive<Record<string, Record<string, PoolState>>>({});

function createPoolState(): Record<string, PoolState> {
  return reactive<Record<string, PoolState>>({});
}

// 주어진 토큰(key)이 없으면 새 객체를 만들고, 있으면 기존 객체를 반환합니다.
export function getOrCreateTokenMap(key: string): Record<string, PoolState> {
  if (!tokenMaps[key]) {
    console.log("key", key);
    tokenMaps[key] = createPoolState();
  }
  console.log("tokenMaps", tokenMaps);
  return tokenMaps[key];
}

export function usePoolPriceState() {
  // token: 토큰(주소) 키, poolId: 각 풀을 구분하는 식별자
  function initializePool(token: string, poolId: string) {
    const tokenMap = getOrCreateTokenMap(token);
    if (!(poolId in tokenMap)) {
      tokenMap[poolId] = {
        beforeprice: 0,
        categoryDate: [],
        values: [],
        type: [],
        tx: [],
        info: [],
      };
    }
  }

  function getBeforePrice(token: string, poolId: string): number {
    initializePool(token, poolId);
    return getOrCreateTokenMap(token)[poolId].beforeprice;
  }

  function setBeforePrice(token: string, poolId: string, newValue: number) {
    initializePool(token, poolId);
    getOrCreateTokenMap(token)[poolId].beforeprice = newValue;
  }

  function addPoolData(
    token: string,
    poolId: string,
    data: [string, any, string, any],
    info: any
  ) {
    initializePool(token, poolId);
    const poolState = getOrCreateTokenMap(token)[poolId];
    poolState.categoryDate.push(data[0]);
    poolState.values.push(data[1]);
    poolState.type.push(data[2]);
    poolState.tx.push(data[3]);
    poolState.info.push(info);
    console.log("poolState", poolState, token, poolId);
  }

  function addtoAllPoolDatas(data: [string, string, any], info: any) {
    // 모든 tokenMaps 안의 각 토큰의 각 풀에 대해 데이터 추가
    Object.keys(tokenMaps).forEach((token) => {
      Object.keys(tokenMaps[token]).forEach((poolId) => {
        const beforePrice = getBeforePrice(token, poolId);
        const value = [
          beforePrice,
          beforePrice + 0.00000000002,
          beforePrice,
          beforePrice + 0.00000000002,
        ];
        const poolState = tokenMaps[token][poolId];
        poolState.categoryDate.push(data[0]);
        poolState.values.push(value);
        poolState.type.push(data[1]);
        poolState.tx.push(data[2]);
        poolState.info.push(info);
      });
    });
  }

  function addOfferDatas(
    tokenAdd: string,
    poolId: string,
    tx: any,
    date: string,
    info: any
  ) {
    const offerId = info.keyType + info.offerSequence;

    if (info.keyType == "offerCreate") {
      ReactiveOfferState[offerId].takerpay.push(info.takerpay);
      ReactiveOfferState[offerId].takerget.push(info.takerget);
      ReactiveOfferState[offerId].acount = info.acount;
    }
    const poolState = getOrCreateTokenMap(tokenAdd)[poolId];
    const beforePrice = getBeforePrice(tokenAdd, poolId);
    const value = [
      beforePrice,
      beforePrice + 0.00000000001,
      beforePrice,
      beforePrice + 0.00000000001,
    ];

    poolState.categoryDate.push(date);
    poolState.values.push(value);
    poolState.type.push(info.keyType);
    poolState.tx.push(tx);
    poolState.info.push(info);
  }

  function getOfferData(offerId: string) {
    return ReactiveOfferState[offerId];
  }

  function getPoolData(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId];
  }

  function getStateKeys(token: string): string[] {
    return Object.keys(getOrCreateTokenMap(token));
  }

  function getValues(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId].values;
  }

  function getDates(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId].categoryDate;
  }

  function getTypes(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId].type;
  }

  function getTxs(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId].tx;
  }

  function getInfos(token: string, poolId: string) {
    return getOrCreateTokenMap(token)[poolId].info;
  }

  return {
    tokenMaps,
    getBeforePrice,
    setBeforePrice,
    addPoolData,
    addtoAllPoolDatas,
    getPoolData,
    getStateKeys,
    getValues,
    getDates,
    getTypes,
    getTxs,
    getInfos,
    addOfferDatas,
    getOfferData,
    getOrCreateTokenMap,
  };
}
