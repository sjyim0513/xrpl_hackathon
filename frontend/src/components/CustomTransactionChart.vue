<template>
  <div>
    <h2>토큰 트랜잭션 기반 OHLC 차트</h2>
    <!-- 토큰 주소 입력 -->
    <input
      v-model="tokenAddress"
      placeholder="토큰(발행자) 주소를 입력하세요"
    />
    <button @click="fetchAndProcessTx">조회하기</button>

    <!-- 차트 렌더링 -->
    <apexchart
      v-if="ohlcSeries.length"
      type="candlestick"
      height="350"
      :options="chartOptions"
      :series="[{ data: ohlcSeries }]"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import ApexChart from "vue3-apexcharts";
import { Client } from "xrpl";

// 반응형 변수
const tokenAddress = ref("");
const ohlcSeries = ref([]); // [{ x: Date, y: [open, high, low, close] }, ...]
const chartOptions = ref({
  chart: {
    type: "candlestick",
  },
  title: {
    text: "토큰 스왑에 따른 OHLC 차트",
    align: "left",
  },
  xaxis: {
    type: "datetime",
  },
  yaxis: {
    tooltip: {
      enabled: true,
    },
  },
});

// XRPL 클라이언트 초기화 (테스트넷 예시)
const client = new Client("wss://s1.ripple.com/");

// 트랜잭션 조회 및 데이터 처리 함수
async function fetchAndProcessTx() {
  if (!tokenAddress.value) {
    alert("토큰 주소를 입력하세요.");
    return;
  }

  try {
    await client.connect();

    // 예시: account_tx 명령을 사용하여 주소와 연관된 트랜잭션 조회
    // 실제로는 토큰 관련 트랜잭션(예: issued currency, trustline 등) 필터링 필요
    const response = await client.request({
      command: "account_tx",
      account: tokenAddress.value,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 15,
    });

    // 트랜잭션 데이터를 가져옴 rGG3wQ4kUzd7Jnmk1n5NWPZjjut62kCBfC
    console.dir(response.result.transactions, { depth: null });
    const txs = response.result.transactions.map((tx) => tx.tx_json);
    console.log("txs", txs, tokenAddress.value);
    // 각 트랜잭션을 분류하여 swap (buy/sell), transfer, burn 등으로 구분하는 로직
    // 아래는 단순 예시이며, 실제 구현에서는 tx의 타입, Amount, Destination, 메타데이터 등을 분석해야 함.
    const swapTxs = txs.filter((tx) => {
      // 예시: Payment 타입이면서 XRP와 토큰이 교환된 경우 buy로 판단
      return (
        tx.TransactionType === "Payment" &&
        tx.Amount &&
        tx.Issuer === tokenAddress.value
      );
    });

    // 스왑 거래들의 가격(교환 비율) 및 시간 정보를 추출하여 OHLC 데이터 생성
    // 아래는 단순화한 예시: 각 거래의 XRP:token 환율을 가격으로 보고, 일정 시간 간격으로 그룹화
    console.log("swapTxs", swapTxs);
    const candles = generateOHLCData(swapTxs);
    ohlcSeries.value = candles;

    await client.disconnect();
  } catch (err) {
    console.error(err);
    alert("트랜잭션 조회 중 오류 발생");
  }
}

/**
 * generateOHLCData
 * @param {Array} swapTxs - 스왑 거래 배열
 * @returns {Array} - OHLC 데이터 배열 [{ x: Date, y: [open, high, low, close] }, ...]
 *
 * 이 함수는 예시로 일정 시간 단위(예: 1시간)로 그룹화하여
 * 각 그룹의 첫 거래 가격(open), 최대 가격(high), 최소 가격(low), 마지막 가격(close)를 계산합니다.
 * 실제 구현에서는 거래의 타임스탬프(tx.date 등)와 환율 계산 로직이 필요합니다.
 */
function generateOHLCData(swapTxs) {
  // 거래 데이터를 시간순으로 정렬
  swapTxs.sort((a, b) => a.date - b.date); // tx.date는 XRPL의 타임스탬프(유닉스 시간)여야 함

  // 임의로 1시간 간격 그룹화(밀리초 단위: 3600000)
  const groupInterval = 3600000;
  const groups = {};

  swapTxs.forEach((tx) => {
    // 가정: tx.date가 Unix timestamp (초 단위)라면 *1000 해줘야 함
    const timestamp = tx.date * 1000 || Date.now(); // 실제 값에 따라 조정
    const groupTime = Math.floor(timestamp / groupInterval) * groupInterval;
    if (!groups[groupTime]) groups[groupTime] = [];

    // 예시: 가격 계산 - XRP로 지급한 양을 토큰 수량으로 나눈 값
    // 실제로는 tx 내부의 Amount, sendMax, delivered_amount 등의 필드를 분석해야 함.
    const price = parseFloat(tx.Price) || 0; // Price 필드는 실제 데이터에 따라 수정 필요
    groups[groupTime].push(price);
  });

  // 각 그룹별로 OHLC 계산
  const candles = Object.keys(groups).map((time) => {
    const prices = groups[time];
    return {
      x: new Date(parseInt(time)),
      y: [
        prices[0], // open: 첫 거래 가격
        Math.max(...prices), // high: 최고 가격
        Math.min(...prices), // low: 최저 가격
        prices[prices.length - 1], // close: 마지막 거래 가격
      ],
    };
  });

  // 정렬해서 반환
  return candles.sort((a, b) => a.x - b.x);
}
</script>

<style scoped>
/* 간단한 스타일 */
input {
  padding: 0.5rem;
  margin-right: 0.5rem;
}
button {
  padding: 0.5rem 1rem;
}
</style>
