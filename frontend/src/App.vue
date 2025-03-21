<template>
  <div>
    <h2>토큰 트랜잭션 기반 OHLC 차트</h2>
    <input v-model="tokenAdd" placeholder="토큰(발행자) 주소를 입력하세요" />
    <button @click="fetchAndProcessTx">조회하기</button>
  </div>
  <div ref="chartDom" style="width: 100%; height: 1300px"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as echarts from "echarts";
import { Client } from "xrpl";
import { usePoolPriceState } from "./stores/usePoolPriceState";
import type { payment, route, send } from "./interfaces/transaction_interface";

const {
  getBeforePrice,
  setBeforePrice,
  addPoolData,
  addtoAllPoolDatas,
  getPoolData,
} = usePoolPriceState();

const client = new Client("wss://s1.ripple.com/");
const tokenAdd = ref("");
const limit = ref(30);
const ledgerMin = ref(-1);
const ledgerMax = ref(-1);
const poolList = ref("xrp");

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

async function fetchAndProcessTx() {
  if (!tokenAdd.value) {
    alert("토큰 주소를 입력하세요: ");
    return;
  }

  try {
    await client.connect();

    const response = await client.request({
      command: "account_tx",
      account: tokenAdd.value,
      ledger_index_max: ledgerMax.value,
      ledger_index_min: ledgerMin.value,
      limit: limit.value,
    });

    const txs = response.result.transactions;

    await formatData(txs);

    // const values = getValues(poolList.value);
    // const dates = getValues("xrp");

    await client.disconnect();
    updateChart();
  } catch (e) {
    console.log(e);
    alert("트랜잭션 조회 중 오류 발생");
  }
}

function computeCandleColors(
  candles: number[][]
): { value: number[]; itemStyle: { color: string; color0: string } }[] {
  const result: {
    value: number[];
    itemStyle: { color: string; color0: string };
  }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const [open, close, low, high] = candles[i];
    // 효과적인 가격: 여기서는 종가(close)를 사용 (open과 close가 같은 경우 동일)
    const effectivePrice = close;
    let color: string;

    if (i === 0) {
      // 첫 번째 캔들은 비교할 이전 값이 없으므로, 일반적인 규칙: close >= open이면 초록색, 아니면 빨간색.
      color = close >= open ? "green" : "red";
    } else {
      // 만약 시가와 종가가 같다면, 이전 캔들의 효과적 가격과 비교
      if (open === close) {
        const prevEffectivePrice = result[i - 1].value[1]; // 이전 캔들의 종가를 효과적 가격으로 사용
        color = effectivePrice < prevEffectivePrice ? "red" : "green";
      } else {
        // 일반적인 경우: close >= open이면 초록색, 그렇지 않으면 빨간색.
        color = close >= open ? "green" : "red";
      }
    }

    result.push({
      value: candles[i],
      itemStyle: { color: color, color0: color },
    });
  }
  return result;
}

function makedataset(tx: any, isXRP: boolean, isBuy: boolean) {
  try {
    const categoryData = formatDate(tx.tx_json.date);
    if (isXRP) {
      //xrp로 token을 구매한 경우
      if (isBuy) {
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          if (node.hasOwnProperty("ModifiedNode")) {
            return (
              node.ModifiedNode.LedgerEntryType === "AccountRoot" &&
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
        const beforePrice = getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, beforePrice, effectiveRate];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);
        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      } else {
        //이 토큰으로 xrp를 구매한 경우
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          const modified = node.ModifiedNode ?? node.DeletedNode;
          return (
            modified?.LedgerEntryType === "RippleState" &&
            ((modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
              modified.FinalFields.LowLimit.issuer === tokenAdd.value) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd.value))
          );
        });

        if (!nodeWrapper) {
          console.log("ModifiedNode 없음!!!", tx);
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
        const beforePrice = getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, effectiveRate, beforePrice];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);
        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
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
            ((modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
              modified.FinalFields.LowLimit.issuer === tokenAdd.value) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd.value))
          );
        });
        if (!nodeWrapper) {
          console.log("ModifiedNode 없음!!", tx);
          return;
        }
        const modified = nodeWrapper.ModifiedNode ?? nodeWrapper.DeletedNode;
        const sendAmount =
          modified.PreviousFields.Balance.value -
          modified.FinalFields.Balance.value;
        const deliveredAmount = tx.meta.delivered_amount.value;
        const effectiveRate = deliveredAmount / Math.abs(sendAmount);
        const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
        const beforePrice = getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, effectiveRate, beforePrice];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);
        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      } else {
        //다른 토큰을 판매하고 이 토큰을 얻은 경우
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          if (node.hasOwnProperty("ModifiedNode")) {
            const modified = node.ModifiedNode;
            if (modified.LedgerEntryType === "RippleState") {
              return (
                (modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
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
          console.log("ModifiedNode 없음!", tx);
          return;
        }
        const modified = nodeWrapper.ModifiedNode;
        const sendAmount =
          modified.PreviousFields.Balance.value -
          modified.FinalFields.Balance.value;
        const deliveredAmount = tx.meta.delivered_amount.value;
        const effectiveRate = Math.abs(sendAmount) / deliveredAmount;
        const poolId = `${tx.tx_json.SendMax.currency}_${tx.tx_json.SendMax.issuer}`;
        const beforePrice = getBeforePrice(poolId);
        const value = [beforePrice, effectiveRate, beforePrice, effectiveRate];
        const type = tx.tx_json.TransactionType;
        setBeforePrice(poolId, effectiveRate);
        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
        };
        addPoolData(poolId, [categoryData, value, type, tx], info);
      }
    }
  } catch (e) {
    console.log("error: ", e, tx);
  }
}

async function formatData(txs: any[]) {
  txs.forEach((tx) => {
    try {
      const type = tx.tx_json?.TransactionType;
      if (type === "Payment") {
        if (tx.tx_json.Account === tx.tx_json.Destination) {
          const meta = tx.meta;
          const tx_json = tx.tx_json;

          //xrp를 보내고 토큰을 받음 (buy)
          if (typeof tx_json?.SendMax === "string") {
            if (meta.delivered_amount.issuer === tokenAdd.value) {
              makedataset(tx, true, true);
              // console.log("xrp로 구매");
              //받는 토큰이 tokenAddress임 -> currency도 나중에 처리하게 수정해야함
            } else {
              // console.log(
              //   "xrp를 보냈는데 받은 토큰이 tokenAddress가 아님: ",
              //   tx,
              //   meta.delivered_amount.issuer,
              //   tokenAdd.value
              // );
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
          const info: send = {
            keyType: "send",
            account: tx.tx_json.Account,
            fee: tx.tx_json.Fee / 1000000,
            deliveredAmount: tx.meta.delivered_amount.value,
            Destination: tx.tx_json.Destination,
          };
          addtoAllPoolDatas([categoryData, type, tx], info);
        }
      } else if (type == "TrustSet") {
        //price는 beforePrice에 있음
        //모든 pool 배열에 저장
      } else if (type == "OfferCancel" || type == "OfferCreate") {
        //모든 pool 배열에 저장
      }
    } catch (e) {
      console.log("error", e, tx);
    }
  });
}

const chartDom = ref<HTMLDivElement | null>(null);
// chart 인스턴스를 저장할 ref
const myChart = ref<echarts.ECharts | null>(null);
const upColor = "#00da3c";
const downColor = "#ec0000";

function calculateMA(dayCount: number, data: { values: number[][] }) {
  const result: (number | string)[] = [];
  for (let i = 0, len = data.values.length; i < len; i++) {
    if (i < dayCount) {
      result.push("-");
      continue;
    }
    let sum = 0;
    for (let j = 0; j < dayCount; j++) {
      sum += data.values[i - j][1]; // 종가(close) 사용
    }
    result.push(+(sum / dayCount).toFixed(3));
  }
  return result;
}

function updateChart() {
  if (!myChart.value) return;
  // getPoolData()를 이용해 처리된 데이터를 가져와서 새로운 옵션 구성
  const option = getChartOption();
  myChart.value.setOption(option, true);
}

function getChartOption() {
  //일어나서 노트북으로 깃허브꺼 받고 데이터 형태 차이 보기
  const txDate = getPoolData(poolList.value);
  console.log("txDate", txDate);
  console.log("categoryDate", txDate.categoryDate);
  console.log("values", txDate.values[0]);
  return {
    animation: false,
    legend: {
      bottom: 10,
      left: "center",
      data: ["Transactions"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      borderWidth: 1,
      borderColor: "#ccc",
      textStyle: { color: "#000" },
      position: function (
        pos: number[],
        params: any,
        el: any,
        elRect: any,
        size: any
      ) {
        const obj: Record<string, number> = { top: 10 };
        obj[pos[0] < size.viewSize[0] / 2 ? "left" : "right"] = 30;
        return obj;
      },
    },
    xAxis: [
      {
        type: "category",
        data: txDate.categoryDate,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: "dataMin",
        max: "dataMax",
        axisPointer: { z: 100 },
      },
      {
        type: "category",
        gridIndex: 1,
        data: txDate.categoryDate,
        boundaryGap: false,
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
        splitArea: { show: true },
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
        data: txDate.values, // 실제 가격 데이터 배열
        barWidth: "100%",
        itemStyle: {
          color: "#00da3c",
          color0: "#ec0000",
        },
      },
      // {
      //   name: "MA5",
      //   type: "line",
      //   data: calculateMA(5, txDate),
      //   smooth: true,
      //   lineStyle: { opacity: 0.5 },
      // },
      // {
      //   name: "MA10",
      //   type: "line",
      //   data: calculateMA(10, txDate),
      //   smooth: true,
      //   lineStyle: { opacity: 0.5 },
      // },
      // {
      //   name: "MA20",
      //   type: "line",
      //   data: calculateMA(20, txDate),
      //   smooth: true,
      //   lineStyle: { opacity: 0.5 },
      // },
      // {
      //   name: "MA30",
      //   type: "line",
      //   data: calculateMA(30, txDate),
      //   smooth: true,
      //   lineStyle: { opacity: 0.5 },
      // },
    ],
  };
}

onMounted(() => {
  if (chartDom.value) {
    myChart.value = echarts.init(chartDom.value);
    const emptyOption = {
      title: { text: "데이터 없음" },
      xAxis: { data: [] },
      yAxis: {},
      series: [],
    };
    myChart.value.setOption(emptyOption);
  }
});

// // 브러시(brush) 액션으로 특정 범위 강조 (예시: 임의의 날짜 범위)
// myChart.dispatchAction({
//   type: "brush",
//   areas: [
//     {
//       brushType: "lineX",
//       coordRange: ["2023/01/10", "2023/01/20"],
//       xAxisIndex: 0,
//     },
//   ],
// });
</script>
