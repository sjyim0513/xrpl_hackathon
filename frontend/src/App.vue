<template>
  <div class="header">
    <div class="logo-contaier">
      <div class="logo">con-tracker</div>
      <div class="search-Container">
        <input
          class="search-input"
          v-model="tokenAdd"
          placeholder=" 토큰(발행자) 주소를 입력하세요"
        />
        <v-btn class="searchbtn" variant="outlined" @click="fetchAndProcessTx"
          >조회하기</v-btn
        >
      </div>
    </div>
    <div class="tokenlist-container">
      <div class="tokenlist">
        <div class="from">{{ currency }}</div>
        <span style="color: #cecece; margin: 0 10px 0 10px">/</span>
        <div class="to">
          <v-select
            v-model="poolList"
            :items="stateKeys"
            variant="plain"
            hide-details
            density="compact"
            append-icon=""
            class="no-border-select center-text-select"
          ></v-select>
        </div>
      </div>
    </div>
  </div>

  <div class="main-container">
    <div class="chart" ref="chartDom" style="width: 75%; height: 90vh"></div>
    <TransactionCard :transactions="selectedTransactions" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as echarts from "echarts";
import { Client, type AccountTxRequest } from "xrpl";
import { usePoolPriceState } from "./stores/usePoolPriceState";
import type {
  payment,
  route,
  send,
  TokenInfo,
} from "./interfaces/transaction_interface";
import TokenPairList from "./components/TokenPairList.vue";
import TransactionCard from "./components/TransactionCard.vue";
import { error } from "echarts/types/src/util/log.js";
import { error } from "echarts/types/src/util/log.js";

const {
  getBeforePrice,
  setBeforePrice,
  addPoolData,
  addtoAllPoolDatas,
  getPoolData,
  getOfferData,
  addOfferDatas,
} = usePoolPriceState();

// const client = new Client("wss://s1.ripple.com/");
const client = new Client(
  "wss://xrp-mainnet.g.allthatnode.com/full/json_rpc/e5dd0ee1279b440aa7a4661b8bf3f829"
);
const tokenAdd = ref("");

const limit = ref(10000);
const currency = ref("");
const ledgerMin = ref(-1);
const ledgerMax = ref(-1);
const poolList = ref("xrp");
const selectedTransactions = ref<any[]>([]);
let chart: echarts.ECharts;
let originalColoredData: any[] = [];
let globalColoredData: any[] = [];


function calculatePoolId(tokenAdd: { value: string }, offer: any): string {
  // takerget가 객체 형태인 경우 처리
  if (typeof offer.takerget !== "string" && offer.takerget.issuer !== tokenAdd.value) {
    if (offer.takerget.issuer !== tokenAdd.value) {
      return offer.takerget.issuer + offer.takerget.currency;
    }
  }
  
  // takerpay가 객체 형태인 경우 처리
  if (typeof offer.takerpay !== "string" && offer.takerget.issuer !== tokenAdd.value) {
    if (offer.takerpay.issuer !== tokenAdd.value) {
      return offer.takerpay.issuer + offer.takerpay.currency;
    }
  }
  
  // 두 필드 모두 문자열인 경우 poolId를 "xrp"로 설정
  return "xrp";
}

function isNotExistingOfferCreate (offerSequence: any) {
  const offerId = "OfferCreate" + offerSequence
  try {
    getOfferData(offerId)
    return false
  } catch (error) {
    return true
  }
}

function getPoolId(offerSequence: any) {
  const offerId = "OfferCreate" + offerSequence
  const originalOffer = getOfferData(offerId)
  return calculatePoolId(tokenAdd, originalOffer)
}


const { state } = usePoolPriceState();

// state의 key들을 computed로 만듭니다.
const stateKeys = computed(() => Object.keys(state));

function decode(add: string) {
  let str = "";
  for (let i = 0; i < add.length; i += 2) {
    const code = parseInt(add.substr(i, 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

function processTokenAddress(input: string): TokenInfo | string {
  if (input.length >= 35) {
    const parts = input.split(".");
    if (parts.length >= 2) {
      return {
        currency: parts[0],
        issuer: parts[1],
      };
    } else {
      return input;
    }
  } else {
    return input;
  }
}

function formatDate(date: number): string {
  const utc_sec = date + 946684800;
  const d = new Date(utc_sec * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function isOfferProcessingPayment(tx: any): boolean {
  // Payment 트랜잭션이 아니면 false 반환
  if (tx.tx_json.TransactionType !== "Payment") return false;
  
  // meta나 AffectedNodes가 없으면 false 반환
  if (!tx.meta || !tx.meta.AffectedNodes) return false;
  
  // AffectedNodes 배열 내에서 Offer 관련 노드가 하나라도 있는지 확인
  return tx.meta.AffectedNodes.some((node: any) => {
    if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer") return true;
    if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "Offer") return true;
    if (node.DeletedNode && node.DeletedNode.LedgerEntryType === "Offer") return true;
    return false;
  });
}

function getOfferSequenceAndAmounts(tx: any): { sequences: number[]; amounts: number[] } {
  const sequences: number[] = [];
  const amounts: number[] = [];

  if (!tx.meta || !tx.meta.AffectedNodes) return { sequences, amounts };

  tx.meta.AffectedNodes.forEach((node: any) => {
    // Offer 노드가 있는지 확인 (CreatedNode, ModifiedNode, DeletedNode 중 하나)
    let offerNode = null;
    if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "Offer") {
      offerNode = node.CreatedNode;
    } else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "Offer") {
      offerNode = node.ModifiedNode;
    } else if (node.DeletedNode && node.DeletedNode.LedgerEntryType === "Offer") {
      offerNode = node.DeletedNode;
    } 
    if (offerNode) {
      // Offer 노드에서 Sequence 값 추출 (NewFields 또는 FinalFields)
      const seq = offerNode.NewFields?.Sequence ?? offerNode.FinalFields?.Sequence;
      if (seq !== undefined) {
        sequences.push(seq);
      }
      // Offer 노드에서 TakerPays 금액 추출 (NewFields 또는 FinalFields)
      const takerPays = offerNode.NewFields?.TakerPays ?? offerNode.FinalFields?.TakerPays;
      if (takerPays !== undefined) {
        let amount: number = 0;
        if (typeof takerPays === "string") {
          amount = parseFloat(takerPays);
        } else if (typeof takerPays === "object" && takerPays.value !== undefined) {
          amount = parseFloat(takerPays.value);
        }
        amounts.push(amount);
      }
    }
  });
  return { sequences, amounts };
}

function parseTx(tx: any){
  const txJson = tx.tx_json;
  
  // 공통 필드 처리 (수수료는 XRPL 단위로 10^6 나누기)
  const fee = Number(txJson.fee) / 1000000;
  const account = txJson.account;
  const offerSequence = Number(txJson.sequence);

  // TransactionType에 따른 분기 처리
  if (txJson.TransactionType === "OfferCreate") {
    // TakerGets 처리: 문자열이면 XRPL 단위, 객체이면 currency, issuer, value 필드 변환
    let takerget: string | { currency: string; issuer: string; value: string };
    if (typeof txJson.TakerGets === "string") {
      takerget = (Number(txJson.TakerGets) / 1000000).toString();
    } else {
      takerget = {
        currency: txJson.TakerGets.currency,
        issuer: txJson.TakerGets.issuer,
        value: (Number(txJson.TakerGets.value) / 1000000).toString(),
      };
    }

    // TakerPays 처리: 문자열이면 XRPL 단위, 객체이면 currency, issuer, value 필드 변환
    let takerpay: string | { currency: string; issuer: string; value: string };
    if (typeof txJson.TakerPays === "string") {
      takerpay = (Number(txJson.TakerPays) / 1000000).toString();
    } else {
      takerpay = {
        currency: txJson.TakerPays.currency,
        issuer: txJson.TakerPays.issuer,
        value: (Number(txJson.TakerPays.value) / 1000000).toString(),
      };
    }

    return {
      keyType: "OfferCreate",
      offerSequence,
      account,
      fee,
      takerpay,
      takerget,
    } 
  } else if (txJson.TransactionType === "OfferCancel") {
    // OfferCancel의 경우 추가 데이터(tx_json.date, tx_json.OfferSequence 등)는 별도 처리가 가능하나,
    // 인터페이스에 정의된 keyType, offerSequence, account, fee만 info 객체에 포함합니다.
    return {
      keyType: "OfferCancel",
      offerSequence,
      account,
      fee,
    } 
  } else {
    throw new Error("지원하지 않는 트랜잭션 타입입니다.");
  }
}



async function fetchAndProcessTx() {
  if (!tokenAdd.value) {
    alert("토큰 주소를 입력하세요: ");
    return;
  }
  const address = await processTokenAddress(tokenAdd.value);
  console.dir(address);
  chart.showLoading({
    text: "데이터 로딩중...",
    textColor: "#FAF9F6",
    color: "#FAF9F6",
    maskColor: "rgba(0, 0, 0, 0.5)",
    zlevel: 0,
  });

  try {
    await client.connect();
    let allTxs: any[] = [];

    // limit 값이 0이면 전체 트랜잭션(마커 반복 호출) 가져오기
    if (limit.value === 0) {
      let marker: string | undefined = undefined;
      do {
        const request: AccountTxRequest = {
          command: "account_tx",
          account: tokenAdd.value,
          ledger_index_max: ledgerMax.value,
          ledger_index_min: ledgerMin.value,
          limit: 200, // 페이지당 고정값(예: 200)으로 반복 호출
          ...(marker ? { marker } : {}),
        };

        const response = await client.request(request);
        const txs = response.result.transactions;
        allTxs = allTxs.concat(txs);
        console.log("전체 allTxs 개수:", allTxs.length);
        marker = response.result.marker;
      } while (marker);
    } else {
      // limit 값이 0이 아니면 한 번만 호출
      const request: AccountTxRequest = {
        command: "account_tx",
        account: tokenAdd.value,
        ledger_index_max: ledgerMax.value,
        ledger_index_min: ledgerMin.value,
        limit: limit.value,
      };

      const response = await client.request(request);
      allTxs = response.result.transactions;
      console.log("allTxs 개수:", allTxs.length);
    }


    // gateway_balances 호출하여 obligations 확인
    const gate_response = await client.request({
      command: "gateway_balances",
      account: tokenAdd.value,
    });
    const obligations = gate_response.result.obligations;
    // const obligationsLength = obligations ? Object.keys(obligations).length : 0;

    if (obligations && Object.keys(obligations).length === 1) {
      const currencyHex = Object.keys(obligations)[0];
      currency.value = decode(currencyHex);
      console.log("currency.value", currency.value);
      await formatData(allTxs);
    } else {
      await formataData_multy(allTxs);
    }
    updateChart();
    await client.disconnect();
  } catch (e) {
    console.log(e);
    alert("트랜잭션 조회 중 오류 발생");
  } finally {
    chart.hideLoading();
  }
}

function makedataset(tx: any, isXRP: boolean, isBuy: boolean) {
  const {sequences, amounts} = getOfferSequenceAndAmounts(tx)
  const {sequences, amounts} = getOfferSequenceAndAmounts(tx)
  try {
    const categoryData = formatDate(tx.tx_json.date);
    if (isXRP) {
      //xrp로 token을 구매한 경우
      if (isBuy) {
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          if (node.hasOwnProperty("ModifiedNode")) {
            return (
              node.ModifiedNode.LedgerEntryType === "AccountRoot" &&
              node.ModifiedNode.FinalFields &&
              node.ModifiedNode.FinalFields.Account === tx.tx_json.Account
            );
            
          }

        });

        if (!nodeWrapper) {
          console.log("ModifiedNode 없음", tx);
          return;
        }

        const modifiedNode = nodeWrapper.ModifiedNode;
        const sendAmount =
          (modifiedNode.PreviousFields.Balance -
            modifiedNode.FinalFields.Balance) /
          1000000;
        const deliveredAmount = Math.abs(tx.meta.delivered_amount.value);
        const effectiveRate = sendAmount / deliveredAmount;
        const poolId = "xrp";
        const beforePrice =
          getBeforePrice(poolId) == 0 ? effectiveRate : getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, beforePrice, effectiveRate];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);

        
        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          offerSequence: sequences,
          offerAmount: amounts,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      } else {
        //이 토큰으로 xrp를 구매한 경우
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          const modified = node.ModifiedNode ?? node.DeletedNode;
          return (
            modified?.LedgerEntryType === "RippleState" &&
            modified.FinalFields &&
            ((modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
              modified.FinalFields.LowLimit.issuer === tokenAdd.value) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd.value))
          );
        });

        if (!nodeWrapper) {
          console.log("ModifiedNode 없음", tx);
          return;
        }

        // 수정: nodeWrapper가 ModifiedNode인지 DeletedNode인지 확인
        const modified = nodeWrapper.ModifiedNode ?? nodeWrapper.DeletedNode;
        const sendAmount =
          modified.PreviousFields.Balance.value -
          modified.FinalFields.Balance.value;
        const deliveredAmount = tx.meta.delivered_amount / 1000000;
        const effectiveRate = deliveredAmount / Math.abs(sendAmount);
        const poolId = "xrp";
        const beforePrice =
          getBeforePrice(poolId) == 0 ? effectiveRate : getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, effectiveRate, beforePrice];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);

        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          offerSequence: sequences,
          offerAmount: amounts,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      }
    } else {
      //이 token으로 다른 토큰을 구매한 경우
      if (!isBuy) {
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          const modified = node.ModifiedNode ?? node.DeletedNode;
          return (
            modified?.LedgerEntryType === "RippleState" &&
            modified.FinalFields &&
            ((modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
              modified.FinalFields.LowLimit.issuer === tokenAdd.value) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd.value))
          );
        });
        if (!nodeWrapper) {
          console.log("ModifiedNode 없음", tx);
          return;
        }
        const modified = nodeWrapper.ModifiedNode ?? nodeWrapper.DeletedNode;
        const sendAmount =
          modified.PreviousFields.Balance.value -
          modified.FinalFields.Balance.value;
        const deliveredAmount = tx.meta.delivered_amount.value;
        const effectiveRate = deliveredAmount / Math.abs(sendAmount);
        const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
        const beforePrice =
          getBeforePrice(poolId) == 0 ? effectiveRate : getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, effectiveRate, beforePrice];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);

        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          offerSequence: sequences,
          offerAmount: amounts,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      } else {
        //다른 토큰을 판매하고 이 토큰을 얻은 경우
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          if (node.hasOwnProperty("ModifiedNode")) {
            const modified = node.ModifiedNode;
            if (modified.LedgerEntryType === "RippleState") {
              return (
                (modified.FinalFields &&
                  modified.FinalFields.HighLimit.issuer ===
                    tx.tx_json.Account &&
                  modified.FinalFields.LowLimit.issuer ===
                    tx.tx_json.SendMax.issuer) ||
                (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                  modified.FinalFields.HighLimit.issuer ===
                    tx.tx_json.SendMax.issuer)
              );
            }
          }
        });
        if (!nodeWrapper) {
          console.log("ModifiedNode 없음", tx);
          return;
        }
        const modified = nodeWrapper.ModifiedNode;
        const sendAmount =
          modified.PreviousFields.Balance.value -
          modified.FinalFields.Balance.value;
        const deliveredAmount = tx.meta.delivered_amount.value;
        const effectiveRate = Math.abs(sendAmount) / deliveredAmount;
        const poolId = `${tx.tx_json.SendMax.currency}_${tx.tx_json.SendMax.issuer}`;
        const beforePrice =
          getBeforePrice(poolId) == 0 ? effectiveRate : getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, beforePrice, effectiveRate];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);
        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          offerSequence: sequences,
          offerAmount: amounts,
          
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      }
    }
  } catch (e) {
    console.log("error: ", e, tx);
  }
}

async function formataData_multy(txs: any[]) {
  const reversedTxs = [...txs].reverse();
  for (const tx of reversedTxs) {
    try {
      const type = tx.tx_json?.TransactionType;
      if (type === "Payment") {
        //send인지 내 안에서 도는건지 확인
        if (tx.tx_json.Account === tx.tx_json.Destination) {
          const meta = tx.meta;
          const tx_json = tx.tx_json;

          //xrp를 보내고 토큰을 받음 (buy)
          if (typeof tx_json?.SendMax === "string") {
            if (meta.delivered_amount.issuer === tokenAdd.value) {
              const tokenMap = getOrCreateTokenMap(
                meta.delivered_amount.currency
              );
              console.dir("tokenMap", tokenMap);
              makedataset(tx, true, true);
  
              // console.log("xrp로 구매");
              //받는 토큰이 tokenAddress임 -> currency도 나중에 처리하게 수정해야함
            } else {
              // console.log("xrp를 보냈는데 받은 토큰이 tokenAddress가 아님: ");
              const categoryData = formatDate(tx.tx_json.date);
              const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
              const beforePrice = getBeforePrice(poolId);
              const value = [
                beforePrice,
                beforePrice,
                beforePrice,
                beforePrice,
              ];
              const info: route = {
                keyType: "route",
                account: tx.tx_json.Account,
                fee: tx.tx_json.Fee / 1000000,
              };
              addPoolData(poolId, [categoryData, value, type, tx], info);
            }
          } else if (tx_json?.SendMax?.issuer === tokenAdd.value) {
            //받은 토큰이 xrp
            if (typeof meta.delivered_amount === "string") {
              makedataset(tx, true, false);
              // console.log("토큰 판매 후 xrp 받음");
            } else {
              makedataset(tx, false, true);
              // console.log("이 토큰으로 다른 토큰 구매:  ");
            }
          } else if (meta.delivered_amount.issuer === tokenAdd.value) {
            //다른 토큰에서 현재 토큰으로 변환
            makedataset(tx, false, false);
            // console.log("다른 토큰으로 이 토큰을 구매함");
          }
        } else {
          const categoryData = formatDate(tx.tx_json.date);
          const delivered =
            typeof tx.meta.delivered_amount === "string"
              ? tx.meta.delivered_amount / 1000000
              : tx.meta.delivered_amount.value;
          const info: send = {
            keyType: "send",
            account: tx.tx_json.Account,
            fee: tx.tx_json.Fee / 1000000,
            deliveredAmount: delivered,
            Destination: tx.tx_json.Destination,
          };
          addtoAllPoolDatas([categoryData, type, tx], info);
        }
      } else if (type == "TrustSet") {
        const categoryData = formatDate(tx.tx_json.date);

        const keyType = "trustLine";
        const account = tx.tx_json.Account;
        const fee = tx.tx_json.Fee / 1000000;

        let amount = "";
        if (tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.value) {
          amount = tx.tx_json.LimitAmount.value;
        }

        const info = {
          keyType,
          account,
          fee,
          amount,
        };

        addtoAllPoolDatas([categoryData, type, tx], info);
      } else if (type == "OfferCancel" || type == "OfferCreate") {
        //모든 pool 배열에 저장
      }
    } catch (e) {
      console.log("error", e, tx);
    }
  });
}

async function formataData_issuer(txs: any[]) {
  const reversedTxs = [...txs].reverse();
  reversedTxs.forEach((tx) => {
    try {
      const type = tx.tx_json?.TransactionType;
      if (type === "Payment") {
        if (tx.tx_json.Account === tx.tx_json.Destination) {
          const meta = tx.meta;
          const tx_json = tx.tx_json;

          //xrp를 보내고 토큰을 받음 (buy)
          if (typeof tx_json?.SendMax === "string") {
            if (meta.delivered_amount.issuer === tokenAdd.value) {
              const tokenMap = getOrCreateTokenMap(
                meta.delivered_amount.currency
              );
              console.dir(tokenMap);
              makedataset(tx, true, true);
              // console.log("xrp로 구매");
              //받는 토큰이 tokenAddress임 -> currency도 나중에 처리하게 수정해야함
            } else {
              // console.log("xrp를 보냈는데 받은 토큰이 tokenAddress가 아님: ");
              const categoryData = formatDate(tx.tx_json.date);
              const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
              const beforePrice = getBeforePrice(poolId);
              const value = [
                beforePrice,
                beforePrice,
                beforePrice,
                beforePrice,
              ];
              const info: route = {
                keyType: "route",
                account: tx.tx_json.Account,
                fee: tx.tx_json.Fee / 1000000,
              };
              addPoolData(poolId, [categoryData, value, type, tx], info);
            }
          } else if (tx_json?.SendMax?.issuer === tokenAdd.value) {
            //받은 토큰이 xrp
            if (typeof meta.delivered_amount === "string") {
              makedataset(tx, true, false);
              // console.log("토큰 판매 후 xrp 받음");
            } else {
              makedataset(tx, false, true);
              // console.log("이 토큰으로 다른 토큰 구매:  ");
            }
          } else if (meta.delivered_amount.issuer === tokenAdd.value) {
            //다른 토큰에서 현재 토큰으로 변환
            makedataset(tx, false, false);
            // console.log("다른 토큰으로 이 토큰을 구매함");
          }
        } else {
          const categoryData = formatDate(tx.tx_json.date);
          const delivered =
            typeof tx.meta.delivered_amount === "string"
              ? tx.meta.delivered_amount / 1000000
              : tx.meta.delivered_amount.value;
          const info: send = {
            keyType: "send",
            account: tx.tx_json.Account,
            fee: tx.tx_json.Fee / 1000000,
            deliveredAmount: delivered,
            Destination: tx.tx_json.Destination,
          };
          addtoAllPoolDatas([categoryData, type, tx], info);
        }
      } else if (type == "TrustSet") {
        const categoryData = formatDate(tx.tx_json.date);

        const keyType = "trustLine";
        const account = tx.tx_json.Account;
        const fee = tx.tx_json.Fee / 1000000;

        let amount = "";
        if (tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.value) {
          amount = tx.tx_json.LimitAmount.value;
        }

        const info = {
          keyType,
          account,
          fee,
          amount,
        };

        addtoAllPoolDatas([categoryData, type, tx], info);

        //price는 beforePrice에 있음
        //모든 pool 배열에 저장
      } else if (type == "OfferCancel") {

        if (isNotExistingOfferCreate(tx.tx_json?.OfferSequence)) {
          continue
        }
        
        const info = parseTx(tx) 
        const poolId = getPoolId(info.offerSequence)
        addOfferDatas(poolId, tx, tx.tx_json.date, info)


      } else if (type == "OfferCreate") { 
        const info = parseTx(tx) 
        const poolId = calculatePoolId(tokenAdd, info)
        addOfferDatas(poolId, tx, tx.tx_json.date, info)

      }
    } catch (e) {
      console.log("error", e, tx);
    }
  });
}

async function formatData(txs: any[]) {
  const reversedTxs = [...txs].reverse();
  for (const tx of reversedTxs) {
    try {
      const type = tx.tx_json?.TransactionType;
      if (type === "Payment") {
        if (tx.tx_json.Account === tx.tx_json.Destination) {
          const meta = tx.meta;
          const tx_json = tx.tx_json;

          //xrp를 보내고 토큰을 받음 (buy)
          if (typeof tx_json?.SendMax === "string") {
            if (meta.delivered_amount.issuer === tokenAdd.value) {
              const tokenMap = getOrCreateTokenMap(
                meta.delivered_amount.currency
              );
              console.dir(tokenMap);
              makedataset(tx, true, true);
  
              // console.log("xrp로 구매");
              //받는 토큰이 tokenAddress임 -> currency도 나중에 처리하게 수정해야함
            } else {
              // console.log("xrp를 보냈는데 받은 토큰이 tokenAddress가 아님: ");
              const categoryData = formatDate(tx.tx_json.date);
              const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
              const beforePrice = getBeforePrice(poolId);
              const value = [
                beforePrice,
                beforePrice,
                beforePrice,
                beforePrice,
              ];
              const info: route = {
                keyType: "route",
                account: tx.tx_json.Account,
                fee: tx.tx_json.Fee / 1000000,
              };
              addPoolData(poolId, [categoryData, value, type, tx], info);
            }
          } else if (tx_json?.SendMax?.issuer === tokenAdd.value) {
            //받은 토큰이 xrp
            if (typeof meta.delivered_amount === "string") {
              makedataset(tx, true, false);
              // console.log("토큰 판매 후 xrp 받음");
            } else {
              makedataset(tx, false, true);
              // console.log("이 토큰으로 다른 토큰 구매:  ");
            }
          } else if (meta.delivered_amount.issuer === tokenAdd.value) {
            //다른 토큰에서 현재 토큰으로 변환
            makedataset(tx, false, false);
            // console.log("다른 토큰으로 이 토큰을 구매함");
          }
        } else {
          const categoryData = formatDate(tx.tx_json.date);
          const delivered =
            typeof tx.meta.delivered_amount === "string"
              ? tx.meta.delivered_amount / 1000000
              : tx.meta.delivered_amount.value;
          const info: send = {
            keyType: "send",
            account: tx.tx_json.Account,
            fee: tx.tx_json.Fee / 1000000,
            deliveredAmount: delivered,
            Destination: tx.tx_json.Destination,
          };
          addtoAllPoolDatas([categoryData, type, tx], info);
        }
      } else if (type == "TrustSet") {
        const categoryData = formatDate(tx.tx_json.date);

        const keyType = "trustLine";
        const account = tx.tx_json.Account;
        const fee = tx.tx_json.Fee / 1000000;

        let amount = "";
        if (tx.tx_json.LimitAmount && tx.tx_json.LimitAmount.value) {
          amount = tx.tx_json.LimitAmount.value;
        }

        const info = {
          keyType,
          account,
          fee,
          amount,
        };

        addtoAllPoolDatas([categoryData, type, tx], info);

        //price는 beforePrice에 있음
        //모든 pool 배열에 저장
      } else if (type == "OfferCancel") {

        if (isNotExistingOfferCreate(tx.tx_json?.OfferSequence)) {
          continue
        }
        
        const info = parseTx(tx) 
        const poolId = getPoolId(info.offerSequence)
        addOfferDatas(poolId, tx, tx.tx_json.date, info)


      } else if (type == "OfferCreate") { 
        const info = parseTx(tx) 
        const poolId = calculatePoolId(tokenAdd, info)
        addOfferDatas(poolId, tx, tx.tx_json.date, info)

      }
    } catch (e) {
      console.log("error", e, tx);
    }
  };
  }
 
    


const chartDom = ref<HTMLDivElement | null>(null);

onMounted(() => {
  if (!chartDom.value) return;
  const myChart = echarts.init(chartDom.value);
  chart = myChart;

  const option = {
    backgroundColor: "#111111",
    animation: false,
    legend: {
      bottom: 70,
      left: "center",
      data: ["Transactions"],
      textStyle: {
        color: "#FAF9F6",
        fontSize: 13,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      borderWidth: 1,
      borderColor: "#ccc",
      textStyle: {
        color: "#000",
      },
      formatter: function (params: any) {
        return `<strong>Transaction:</strong><br/><strong>Time:</strong>`;
      },
      position: function (
        pos: number[],
        params: any,
        el: any,
        elRect: any,
        size: any
      ) {
        const tooltipHeight = elRect && elRect.height ? elRect.height : -100;
        let top = pos[1] - tooltipHeight - 10;
        if (top < 0) {
          top = pos[1] + 10;
        }
        let left = pos[0];
        if (left + 150 > size.viewSize[0]) {
          left = size.viewSize[0] - 150;
        }
        return { left, top };
      },
    },
    axisPointer: {
      link: [
        {
          xAxisIndex: "all",
        },
      ],
      label: {
        backgroundColor: "#777",
      },
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: false,
        },
        brush: {
          type: ["lineX", "clear"],
        },
      },
    },
    // brush: {
    //   xAxisIndex: "all",
    //   brushLink: "all",
    //   outOfBrush: {
    //     colorAlpha: 0.1,
    //   },
    // },
    // visualMap: {
    //   show: false,
    //   seriesIndex: 5,
    //   dimension: 2,
    //   pieces: [
    //     {
    //       value: 1,
    //       color: downColor,
    //     },
    //     {
    //       value: -1,
    //       color: upColor,
    //     },
    //   ],
    // },
    grid: [
      {
        left: "8%",
        right: "5%",
        height: "70%", // 메인 차트 영역을 60%로 늘림
        backgroundColor: "#111111",
      },
      {
        left: "8%",
        right: "5%",
        top: "20%", // 보조 차트 영역의 위치도 약간 조정
        height: "50%", // 보조 영역을 20%로 늘림
        backgroundColor: "#111111",
      },
    ],
    xAxis: [
      {
        type: "category",
        data: [
          "2013/1/24",
          "2013/1/25",
          "2013/1/28",
          "2013/1/29",
          "2013/1/30",
          "2013/1/31",
          "2013/2/1",
          "2013/2/4",
          "2013/2/5",
          "2013/2/6",
          "2013/2/7",
          "2013/2/8",
          "2013/2/18",
          "2013/2/19",
          "2013/2/20",
          "2013/2/21",
          "2013/2/22",
          "2013/2/25",
          "2013/2/26",
          "2013/2/27",
          "2013/2/28",
          "2013/3/1",
          "2013/3/4",
          "2013/3/5",
          "2013/3/6",
          "2013/3/7",
          "2013/3/8",
          "2013/3/11",
          "2013/3/12",
          "2013/3/13",
          "2013/3/14",
          "2013/3/15",
          "2013/3/18",
          "2013/3/19",
          "2013/3/20",
          "2013/3/21",
          "2013/3/22",
          "2013/3/25",
          "2013/3/26",
          "2013/3/27",
          "2013/3/28",
          "2013/3/29",
          "2013/4/1",
          "2013/4/2",
          "2013/4/3",
          "2013/4/8",
          "2013/4/9",
          "2013/4/10",
          "2013/4/11",
          "2013/4/12",
          "2013/4/15",
          "2013/4/16",
          "2013/4/17",
          "2013/4/18",
          "2013/4/19",
          "2013/4/22",
          "2013/4/23",
          "2013/4/24",
          "2013/4/25",
          "2013/4/26",
          "2013/5/2",
          "2013/5/3",
          "2013/5/6",
          "2013/5/7",
          "2013/5/8",
          "2013/5/9",
          "2013/5/10",
          "2013/5/13",
          "2013/5/14",
          "2013/5/15",
          "2013/5/16",
          "2013/5/17",
          "2013/5/20",
          "2013/5/21",
          "2013/5/22",
          "2013/5/23",
          "2013/5/24",
          "2013/5/27",
          "2013/5/28",
          "2013/5/29",
          "2013/5/30",
          "2013/5/31",
          "2013/6/3",
          "2013/6/4",
          "2013/6/5",
          "2013/6/6",
          "2013/6/7",
          "2013/6/13",
        ],
        // boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: "#1E1E1F",
          },
        },
        axisLabel: {
          color: "#FAF9F6",
        },
        min: "dataMin",
        max: "dataMax",
        axisPointer: {
          z: 100,
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: [
          "2013/1/24",
          "2013/1/25",
          "2013/1/28",
          "2013/1/29",
          "2013/1/30",
          "2013/1/31",
          "2013/2/1",
          "2013/2/4",
          "2013/2/5",
          "2013/2/6",
          "2013/2/7",
          "2013/2/8",
          "2013/2/18",
          "2013/2/19",
          "2013/2/20",
          "2013/2/21",
          "2013/2/22",
          "2013/2/25",
          "2013/2/26",
          "2013/2/27",
          "2013/2/28",
          "2013/3/1",
          "2013/3/4",
          "2013/3/5",
          "2013/3/6",
          "2013/3/7",
          "2013/3/8",
          "2013/3/11",
          "2013/3/12",
          "2013/3/13",
          "2013/3/14",
          "2013/3/15",
          "2013/3/18",
          "2013/3/19",
          "2013/3/20",
          "2013/3/21",
          "2013/3/22",
          "2013/3/25",
          "2013/3/26",
          "2013/3/27",
          "2013/3/28",
          "2013/3/29",
          "2013/4/1",
          "2013/4/2",
          "2013/4/3",
          "2013/4/8",
          "2013/4/9",
          "2013/4/10",
          "2013/4/11",
          "2013/4/12",
          "2013/4/15",
          "2013/4/16",
          "2013/4/17",
          "2013/4/18",
          "2013/4/19",
          "2013/4/22",
          "2013/4/23",
          "2013/4/24",
          "2013/4/25",
          "2013/4/26",
          "2013/5/2",
          "2013/5/3",
          "2013/5/6",
          "2013/5/7",
          "2013/5/8",
          "2013/5/9",
          "2013/5/10",
          "2013/5/13",
          "2013/5/14",
          "2013/5/15",
          "2013/5/16",
          "2013/5/17",
          "2013/5/20",
          "2013/5/21",
          "2013/5/22",
          "2013/5/23",
          "2013/5/24",
          "2013/5/27",
          "2013/5/28",
          "2013/5/29",
          "2013/5/30",
          "2013/5/31",
          "2013/6/3",
          "2013/6/4",
          "2013/6/5",
          "2013/6/6",
          "2013/6/7",
          "2013/6/13",
        ],
        // boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    yAxis: [
      {
        scale: true,
        splitNumber: 10,
        splitLine: {
          show: true,
          lineStyle: {
            color: "#1E1E1F",
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ["#111111", "#111111"],
          },
        },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0, 1],
        start: 0,
        end: 100,
      },
      {
        show: true,
        xAxisIndex: [0, 1],
        type: "slider",
        top: "90%",
        start: 0,
        end: 100,
      },
    ],
    series: [
      {
        name: "Transactions",
        type: "candlestick",
        itemStyle: {
          color: "#26a69a",
          color0: "#ef5350",
          borderColor: "#26a69a",
          borderColor0: "#ef5350",
        },
        data: [
          [2320.26, 2320.26, 2287.3, 2362.94],
          [2300, 2291.3, 2288.26, 2308.38],
          [2295.35, 2346.5, 2295.35, 2346.92],
          [2347.22, 2358.98, 2337.35, 2363.8],
          [2360.75, 2382.48, 2347.89, 2383.76],
          [2383.43, 2385.42, 2371.23, 2391.82],
          [2377.41, 2419.02, 2369.57, 2421.15],
          [2425.92, 2428.15, 2417.58, 2440.38],
          [2411, 2433.13, 2403.3, 2437.42],
          [2432.68, 2434.48, 2427.7, 2441.73],
          [2430.69, 2418.53, 2394.22, 2433.89],
          [2416.62, 2432.4, 2414.4, 2443.03],
          [2441.91, 2421.56, 2415.43, 2444.8],
          [2420.26, 2382.91, 2373.53, 2427.07],
          [2383.49, 2397.18, 2370.61, 2397.94],
          [2378.82, 2325.95, 2309.17, 2378.82],
          [2322.94, 2314.16, 2308.76, 2330.88],
          [2320.62, 2325.82, 2315.01, 2338.78],
          [2313.74, 2293.34, 2289.89, 2340.71],
          [2297.77, 2313.22, 2292.03, 2324.63],
          [2322.32, 2365.59, 2308.92, 2366.16],
          [2364.54, 2359.51, 2330.86, 2369.65],
          [2332.08, 2273.4, 2259.25, 2333.54],
          [2274.81, 2326.31, 2270.1, 2328.14],
          [2333.61, 2347.18, 2321.6, 2351.44],
          [2340.44, 2324.29, 2304.27, 2352.02],
          [2326.42, 2318.61, 2314.59, 2333.67],
          [2314.68, 2310.59, 2296.58, 2320.96],
          [2309.16, 2286.6, 2264.83, 2333.29],
          [2282.17, 2263.97, 2253.25, 2286.33],
          [2255.77, 2270.28, 2253.31, 2276.22],
          [2269.31, 2278.4, 2250, 2312.08],
          [2267.29, 2240.02, 2239.21, 2276.05],
          [2244.26, 2257.43, 2232.02, 2261.31],
          [2257.74, 2317.37, 2257.42, 2317.86],
          [2318.21, 2324.24, 2311.6, 2330.81],
          [2321.4, 2328.28, 2314.97, 2332],
          [2334.74, 2326.72, 2319.91, 2344.89],
          [2318.58, 2297.67, 2281.12, 2319.99],
          [2299.38, 2301.26, 2289, 2323.48],
          [2273.55, 2236.3, 2232.91, 2273.55],
          [2238.49, 2236.62, 2228.81, 2246.87],
          [2229.46, 2234.4, 2227.31, 2243.95],
          [2234.9, 2227.74, 2220.44, 2253.42],
          [2232.69, 2225.29, 2217.25, 2241.34],
          [2196.24, 2211.59, 2180.67, 2212.59],
          [2215.47, 2225.77, 2215.47, 2234.73],
          [2224.93, 2226.13, 2212.56, 2233.04],
          [2236.98, 2219.55, 2217.26, 2242.48],
          [2218.09, 2206.78, 2204.44, 2226.26],
          [2199.91, 2181.94, 2177.39, 2204.99],
          [2169.63, 2194.85, 2165.78, 2196.43],
          [2195.03, 2193.8, 2178.47, 2197.51],
          [2181.82, 2197.6, 2175.44, 2206.03],
          [2201.12, 2244.64, 2200.58, 2250.11],
          [2236.4, 2242.17, 2232.26, 2245.12],
          [2242.62, 2184.54, 2182.81, 2242.62],
          [2187.35, 2218.32, 2184.11, 2226.12],
          [2213.19, 2199.31, 2191.85, 2224.63],
          [2203.89, 2177.91, 2173.86, 2210.58],
          [2170.78, 2174.12, 2161.14, 2179.65],
          [2179.05, 2205.5, 2179.05, 2222.81],
          [2212.5, 2231.17, 2212.5, 2236.07],
          [2227.86, 2235.57, 2219.44, 2240.26],
          [2242.39, 2246.3, 2235.42, 2255.21],
          [2246.96, 2232.97, 2221.38, 2247.86],
          [2228.82, 2246.83, 2225.81, 2247.67],
          [2247.68, 2241.92, 2231.36, 2250.85],
          [2238.9, 2217.01, 2205.87, 2239.93],
          [2217.09, 2224.8, 2213.58, 2225.19],
          [2221.34, 2251.81, 2210.77, 2252.87],
          [2249.81, 2282.87, 2248.41, 2288.09],
          [2286.33, 2299.99, 2281.9, 2309.39],
          [2297.11, 2305.11, 2290.12, 2305.3],
          [2303.75, 2302.4, 2292.43, 2314.18],
          [2293.81, 2275.67, 2274.1, 2304.95],
          [2281.45, 2288.53, 2270.25, 2292.59],
          [2286.66, 2293.08, 2283.94, 2301.7],
          [2293.4, 2321.32, 2281.47, 2322.1],
          [2323.54, 2324.02, 2321.17, 2334.33],
          [2316.25, 2317.75, 2310.49, 2325.72],
          [2320.74, 2300.59, 2299.37, 2325.53],
          [2300.21, 2299.25, 2294.11, 2313.43],
          [2297.1, 2272.42, 2264.76, 2297.1],
          [2270.71, 2270.93, 2260.87, 2276.86],
          [2264.43, 2242.11, 2240.07, 2266.69],
          [2242.26, 2210.9, 2205.07, 2250.63],
          [2190.1, 2148.35, 2126.22, 2190.1],
        ],
      },
    ],
  };

  myChart.setOption(option);
  chart.on("click", (params: any) => {

  if (params.seriesType !== "candlestick") return;

  const clicked = params.data;
  const clickedAccount = clicked.account;
  const clickedSequence = clicked.info?.offerSequence;

  const isSameAccount =
    selectedTransactions.value.length &&
    selectedTransactions.value[0].account == clickedAccount;

  if (isSameAccount) {
    // 다시 클릭하면 초기화
    selectedTransactions.value = [];
    globalColoredData = originalColoredData.map((d) => ({ ...d }));
  } else {
    selectedTransactions.value = [clicked];

    globalColoredData = originalColoredData.map((dataPoint) => {
      const sameAccount = dataPoint.account == clickedAccount;
      const osq = dataPoint.info?.offerSequence
      Array.isArray(osq) ? osq : [osq]
      const sameSequence = osq.some((seq: number) => {seq == clickedSequence})

      if (sameAccount && dataPoint.tx == clicked.tx) {
        // 🔴 클릭된 캔들
        return {
          ...dataPoint,
          itemStyle: {
            color: "#", //
            borderWidth: 2,
          },
        };
      } else if (sameAccount && sameSequence) {
        // 같은 account, sequence
        return {
          ...dataPoint,
          itemStyle: {
            color: "#80800", // 보라색
            borderWidth: 0,
          },
        };
      }else if (sameAccount) {
        // 🟠 같은 account
        return {
          ...dataPoint,
          itemStyle: {
            color: "#FFA500", // 노란색색
            borderWidth: 0,
          },
        };
      } else if (sameSequence) {
        // 🟢 같은 sequence
        return {
          ...dataPoint,
          itemStyle: {
            color: "#00B992", // 파란색
            borderWidth: 0,
          },
        };
      } else {
        // 기본 색상 유지
        return { ...dataPoint };

      }
    });
  }

  chart.setOption({
    series: [
      {
        data: globalColoredData,
      },
    ],
  });
});

  myChart.dispatchAction({
    type: "brush",
    areas: [
      {
        brushType: "lineX",
        coordRange: ["2023/01/10", "2023/01/20"],
        xAxisIndex: 0,
      },
    ],
  });
});

function updateChart() { 
  if (!chart) return;
  const txdata = getPoolData(poolList.value);
  originalColoredData = txdata.values.map((candle: number[], i: number) => {
    const candleType = txdata.info[i].keyType;
    let itemStyle = {};
    if (candleType === "send") {
      itemStyle = {
        color: "#3F46FF",
        color0: "#3F46FF",
        borderWidth: 0,
      };

    } else if (candleType === "route") {
      //루트 색상
    } else if (candleType === "trustLine") {
      itemStyle = {
        color: "#D482FF",
        color0: "#D482FF",
        borderWidth: 0,
      };
    } else if (candleType === "offerCreate" || candleType === "offerCancel") {
      itemStyle = {
        color: "#00B992",
        color0: "#00B992",
        borderWidth: 0,
      } else {

      if (candle[0] <= candle[1]) {
        // 상승
        itemStyle = { color: "#089981", borderWidth: 0 };
      } else {
        // 하락
        itemStyle = { color: "#F23645", borderWidth: 0 };
      }
    }

    return {
      value: candle,
      itemStyle,
      tx: txdata.tx[i],
      account: txdata.info[i].account,
      info: txdata.info[i],
    };
  });
  globalColoredData = originalColoredData.map((data) => ({ ...data }));
  const option = {
    backgroundColor: "#111111",
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      borderWidth: 1,
      borderColor: "#ccc",
      textStyle: {
        color: "#000",
      },
      formatter: function (params: any) {
        const dataIndex = params[0].dataIndex;
        const datainfo = txdata.info[dataIndex];

        let infoString = "";
        if (datainfo && typeof datainfo === "object") {
          infoString = Object.entries(datainfo)
            .map(([key, value]) => `${key}: ${value}`)
            .join("<br/>");
        }

        return `<strong>Details:</strong><br/>${infoString}`;
      },
      position: function (
        pos: number[],
        params: any,
        el: any,
        elRect: any,
        size: any
      ) {
        const tooltipHeight = elRect && elRect.height ? elRect.height : -100;
        let top = pos[1] - tooltipHeight - 10;
        if (top < 0) {
          top = pos[1] + 10;
        }
        let left = pos[0];
        if (left + 150 > size.viewSize[0]) {
          left = size.viewSize[0] - 150;
        }
        return { left, top };
      },
    },
    xAxis: [
      {
        type: "category",
        data: txdata.categoryDate,
        // boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: "#1E1E1F",
          },
        },
        axisLabel: {
          color: "#FAF9F6",
        },
        min: "dataMin",
        max: "dataMax",
        axisPointer: {
          z: 100,
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: txdata.categoryDate,
        // boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    series: [
      {
        label: { show: true },
        name: "Transactions",
        type: "candlestick",
        data: globalColoredData,
        barWidth: "100%",
      },
    ],
  };

  chart.setOption(option, false);
}

window.addEventListener("resize", () => {
  chart.resize();
});
</script>

<style>
.main-container {
  display: flex;
  align-items: center;
  margin-right: 20px;
}

.logo {
  font-size: 40px;
  color: #cecece;
  text-align: center;
}

.logo-contaier {
  display: flex;
  align-items: center;
  margin-left: 40px;
}

.no-border-select .v-field__outline,
.no-border-select .v-field__details {
  display: none;
}

/* .no-border-select .v-field__prepend-inner {
  margin-right: 0;
} */

.center-text-select .v-field__input {
  text-align: center;
}

.search-Container {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.tokenlist {
  display: flex;
  align-items: center;
}

.search-input {
  margin-left: 20px;
  background-color: #333338;
  border-radius: 5px;
  width: fit-content;
  height: 40px;
  width: 300px;
}

.searchbtn {
  margin-left: 10px;
  color: #cecece !important;
  background: transparent;
}

.tokenaddress {
  color: #cecece;
}

.from {
  color: #cecece;
}

.to {
  color: #cecece;
}
</style>
