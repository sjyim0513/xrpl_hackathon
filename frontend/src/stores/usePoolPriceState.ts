import { reactive } from "vue";
import type { PoolState,  OfferState} from "../interfaces/transaction_interface";

const state = reactive<Record<string, PoolState>>({});
const ReactiveOfferState = reactive<Record<string, OfferState>>({});

export function usePoolPriceState() {
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

  function getBeforePrice(poolId: string): number {
    initializePool(poolId);
    return state[poolId].beforeprice;
  }

  function setBeforePrice(poolId: string, newValue: number) {
    initializePool(poolId);
    state[poolId].beforeprice = newValue;
  }

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
    if (Object.keys(state).length === 0) {
      console.log("없음");
      initializePool("xrp");
    }
    Object.keys(state).forEach((poolId) => {
      const beforePrice = getBeforePrice(poolId);
      const value = [
        beforePrice,
        beforePrice + 0.00000000001,
        beforePrice,
        beforePrice + 0.00000000001,
      ];
      state[poolId].categoryDate.push(data[0]);
      state[poolId].values.push(value);
      state[poolId].type.push(data[1]);
      state[poolId].tx.push(data[2]);
      state[poolId].info.push(info);
    });
  }



  function addOfferDatas(poolId: string, tx: any, date: string, info: any) {
  
    const offerId = info.keyType + info.offerSequence

    if (info.keyType == "offerCreate") {
      ReactiveOfferState[offerId].takerpay.push(info.takerpay)
      ReactiveOfferState[offerId].takerget.push(info.takerget)
      ReactiveOfferState[offerId].acount = info.acount
    };
    
    

    const beforePrice = getBeforePrice(poolId)
    const value = [
    beforePrice,
    beforePrice + 0.00000000001,
    beforePrice,
    beforePrice + 0.00000000001,]
    
    
    state[poolId].categoryDate.push(date);
    state[poolId].values.push(value);
    state[poolId].type.push(info.keyType);
    state[poolId].tx.push(tx);
    state[poolId].info.push(info);
    }

  function getOfferData(offerId: string) {
    return ReactiveOfferState[offerId]
  }
  

  function getPoolData(poolId: string) {
    console.log("state", state);
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
    addOfferDatas,
    getOfferData
    
  };
}