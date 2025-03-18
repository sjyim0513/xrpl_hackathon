<template>
  <!-- 차트를 렌더링할 요소 -->
  <div>
    <h2>토큰 트랜잭션 기반 OHLC 차트</h2>
    <!-- 토큰 주소 입력 -->
    <input v-model="tokenAdd" placeholder="토큰(발행자) 주소를 입력하세요" />
    <button @click="fetchAndProcessTx">조회하기</button>
  </div>
  <div ref="chartDom" style="width: 100%; height: 1300px"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as echarts from "echarts";
import { Client, type AccountTxTransaction } from "xrpl";

const client = new Client("wss://s1.ripple.com/");
const tokenAdd = ref("");

function formatDate(d: Date): string {
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
    alert("토큰 주소를 입력하세요");
    return;
  }

  try {
    await client.connect();

    const response = await client.request({
      command: "account_tx",
      account: tokenAdd.value,
      ledger_index_max: -1,
      ledger_index_min: -1,
      limit: 15,
    });

    console.dir(
      response.result.transactions.filter((tx) => {
        return tx.tx_json?.TransactionType == "OfferCreate";
      })
    );

    const txs = response.result.transactions;

    const { categoryData, values, transactionType } = await formatData(txs);

    //const txs = response.result.transactions.map((tx) => tx.tx_json);

    return { categoryData, values, transactionType };
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

async function formatData(txs: AccountTxTransaction<2>[]) {
  const categoryData = txs.map((tx: any) => {
    const date = new Date(tx.close_time_iso);
    return formatDate(date);
  });
  let beforePrice = 0;
  const values = txs.map((tx: any) => {
    if (tx.tx_json?.TransactionType != "Payment") return beforePrice;

    //buy - 토큰 구분 없이 그냥 모든 buy를 체크 or 여차하면 두번째를 찾게
    //OPEN은 이전 가격 CLOSE가 현재 가격
    /*
      @sell - token으로 xrp로 스왑 / token으로 다른 토큰 스왑
      @buy - xrp로 token 스왑 / 다른 토큰으로 token 스왑

      2번째 토큰 주소가 있으면 
    */
    if (typeof tx.tx_json.SendMax == "object") {
      //SendMax.issuer가 token 주소라면 판매했다는 의미
      if (tx.tx_json.SendMax.issuer == tokenAdd.value) {
        return [beforePrice];
      } else {
        //xrp가 아닌 다른 토큰으로 구매했다는 의미
      }
    } else {
      //xrp로 구매
    }
  });
  const volumes: (number | string)[][] = [];
  const transactionType = txs.map((tx) => {
    return tx.tx_json?.TransactionType;
  });

  console.dir(categoryData);
  console.dir(transactionType);
  return { categoryData, values, volumes, transactionType };
}

const chartDom = ref<HTMLDivElement | null>(null);

const upColor = "#00da3c";
const downColor = "#ec0000";

// rawData의 타입을 (string|number)[][]로 변경
function splitData(rawData: (string | number)[][]) {
  const categoryData: (string | number)[] = [];
  const values: number[][] = [];
  const volumes: (number | string)[][] = [];
  for (let i = 0; i < rawData.length; i++) {
    // 날짜(문자열)는 첫번째 항목
    const row = [...rawData[i]]; // 원본 배열 변경 방지를 위해 복사
    categoryData.push(row.splice(0, 1)[0]);
    // 나머지는 숫자형 데이터라고 가정
    values.push(row as number[]);
    // 거래량 데이터: [index, volume, 조건 (open > close ? 1 : -1)]
    // row[4]는 high, row[0]는 open, row[1]는 close (splitData 호출 후 row 순서는 [open, close, low, high, volume])
    // 하지만 여기서는 dummyData 순서가 [date, open, close, low, high, volume]이므로
    // row[3]은 low, row[2]은 close, row[1]은 open, row[4]는 high, row[5]는 volume.
    // 조건을 간단하게 open > close 비교로 하겠습니다.
    const open = row[0] as number;
    const close = row[1] as number;
    volumes.push([i, row[5], open > close ? 1 : -1]);
  }
  return { categoryData, values, volumes };
}

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

onMounted(() => {
  if (!chartDom.value) return;
  const myChart = echarts.init(chartDom.value);

  // 30개의 임의 데이터 생성
  // 각 데이터 항목: [날짜, open, close, low, high, volume]
  const dummyData: (string | number)[][] = [];
  for (let i = 0; i < 10; i++) {
    const day = i + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `2023/01/${dayStr}`;
    const open = 100 + i;
    const close = open + 10; // 단순 증가
    const low = open;
    const high = close;
    const volume = 1000 + i * 10;
    dummyData.push([date, open, close, low, high, volume]);
  }

  // dummyData를 가공
  console.dir(dummyData);
  const data = splitData(dummyData);
  console.dir(data);
  const option = {
    animation: false,
    legend: {
      bottom: 10,
      left: "center",
      data: ["Transactions", "MA5", "MA10", "MA20", "MA30"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      borderWidth: 1,
      borderColor: "#ccc",
      // padding: 10,
      textStyle: {
        color: "#000",
      },
      position: function (
        pos: number[],
        params: any,
        el: any,
        elRect: any,
        size: any
      ) {
        const obj: Record<string, number> = { top: 10 };
        // 차트의 왼쪽/오른쪽에 따라 위치 지정
        obj[pos[0] < size.viewSize[0] / 2 ? "left" : "right"] = 30;
        return obj;
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
    brush: {
      xAxisIndex: "all",
      brushLink: "all",
      outOfBrush: {
        colorAlpha: 0.1,
      },
    },
    visualMap: {
      show: false,
      seriesIndex: 5,
      dimension: 2,
      pieces: [
        {
          value: 1,
          color: downColor,
        },
        {
          value: -1,
          color: upColor,
        },
      ],
    },
    grid: [
      {
        // left: "10%",
        // right: "8%",
        height: "80%", // 메인 차트 영역을 60%로 늘림
      },
      {
        // left: "10%",
        // right: "8%",
        top: "20%", // 보조 차트 영역의 위치도 약간 조정
        height: "50%", // 보조 영역을 20%로 늘림
      },
    ],
    xAxis: [
      {
        type: "category",
        data: data.categoryData,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: "dataMin",
        max: "dataMax",
        axisPointer: {
          z: 100,
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: data.categoryData,
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
        splitArea: {
          show: true,
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
        data: data.values,
        barWidth: "100%",
        itemStyle: {
          color: upColor,
          color0: downColor,
          borderColor: undefined,
          borderColor0: undefined,
        },
      },
      {
        name: "MA5",
        type: "line",
        data: calculateMA(5, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA10",
        type: "line",
        data: calculateMA(10, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA20",
        type: "line",
        data: calculateMA(20, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA30",
        type: "line",
        data: calculateMA(30, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "Volume",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.volumes,
      },
    ],
  };

  myChart.setOption(option, true);

  // 브러시(brush) 액션으로 특정 범위 강조 (예시: 임의의 날짜 범위)
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
</script>
