// 1. 데이터 인터페이스 정의 (필요한 필드만 예시로)
import { Client } from "xrpl";

interface XRPLTransaction {
  tx_json: {
    TransactionType: string;
    // XRP 결제의 경우 DeliveredAmount는 문자열, IOU 결제의 경우 객체로 나타남
    Amount?: string | { currency: string; issuer: string; value: string };
    DeliverMax?: string | { currency: string; issuer: string; value: string };
    SendMax?: string | { currency: string; issuer: string; value: string };
    // 거래 시간 또는 ledger 정보
    date: number;
  };
  meta: {
    delivered_amount?:
      | string
      | { currency: string; issuer: string; value: string };
    // AffectedNodes 등도 포함됨
  };
  ledger_index: number;
  // 기타 필요한 필드...
}

// 2. 데이터 가져오기 (fetchTransactions 함수)
async function fetchTransactions(
  account: string,
  ledgerMin: number = -1,
  ledgerMax: number = -1,
  limit: number = 50
): Promise<XRPLTransaction[]> {
  const client = new Client("wss://s1.ripple.com/");
  await client.connect();

  const response = await client.request({
    command: "account_tx",
    account,
    ledger_index_min: ledgerMin,
    ledger_index_max: ledgerMax,
    limit,
  });

  await client.disconnect();
  return response.result.transactions as XRPLTransaction[];
}

// 3. 데이터 필터링 함수: 페어별로 분류
interface GroupedTransactions {
  A_XRP: XRPLTransaction[]; // 예: DeliveredAmount가 XRP로 표기된 거래
  A_Other: Record<string, XRPLTransaction[]>; // 예: A와 다른 토큰(예: SIG 등) 거래, 키는 대상 통화 코드
}

function groupTransactions(
  txs: XRPLTransaction[],
  tokenIssuer: string
): GroupedTransactions {
  const groups: GroupedTransactions = { A_XRP: [], A_Other: {} };

  txs.forEach((tx) => {
    // 예를 들어, Payment 거래만 대상으로 함
    if (tx.tx_json.TransactionType !== "Payment") return;

    // DeliveredAmount가 문자열이면 XRP 거래
    if (
      tx.meta.delivered_amount &&
      typeof tx.meta.delivered_amount === "string"
    ) {
      groups.A_XRP.push(tx);
    } else if (tx.tx_json.SendMax) {
      // 만약 SendMax가 객체인 경우, 해당 통화 코드와 발행자 조합으로 분류
      const sendMax = tx.tx_json.SendMax as {
        currency: string;
        issuer: string;
        value: string;
      };
      // 만약 이 SendMax가 우리가 찾는 토큰 (예, Army 토큰: "41524D5900000000000000000000000000000000" + tokenIssuer)와 같다면
      if (
        sendMax.currency === "41524D5900000000000000000000000000000000" &&
        sendMax.issuer === tokenIssuer
      ) {
        // 이 경우에도 XRP 거래일 수도 있으나, 여기서는 A/다른토큰 거래라고 가정
        // 예: 해당 거래 경로에 다른 통화가 포함된 경우, Paths 필드 등을 활용할 수 있음.
        // 여기서는 예시로 sendMax.currency를 키로 사용
        if (!groups.A_Other[sendMax.currency]) {
          groups.A_Other[sendMax.currency] = [];
        }
        groups.A_Other[sendMax.currency].push(tx);
      } else {
        // 만약 다른 토큰과의 거래라면, 해당 토큰 통화 코드를 사용하여 그룹화
        const key = sendMax.currency;
        if (!groups.A_Other[key]) {
          groups.A_Other[key] = [];
        }
        groups.A_Other[key].push(tx);
      }
    }
  });

  return groups;
}

// 4. 데이터 집계 및 차트용 데이터 가공 (예: OHLC 계산, 평균 가격 계산)
// 이 부분은 각 그룹에 대해 원하는 계산식을 적용합니다.
interface ChartDataPoint {
  x: Date;
  y: number; // 예: 평균 가격 또는 마지막 체결 가격
}

function aggregateGroupData(txs: XRPLTransaction[]): ChartDataPoint[] {
  // 간단한 예: 각 트랜잭션의 'date'와 효과적 가격(DeliveredAmount / SendMax 토큰 수량)을 사용해 데이터 포인트 생성
  // 실제 구현에서는 더 정교한 집계(예: OHLC, VWAP 등)를 계산할 수 있습니다.
  return txs.map((tx) => {
    const timestamp = (tx.tx_json.date + 946684800) * 1000; // Ripple Epoch -> Unix 타임스탬프로 변환
    let effectivePrice = 0;
    if (
      tx.meta.delivered_amount &&
      typeof tx.meta.delivered_amount === "string"
    ) {
      const delivered = parseFloat(tx.meta.delivered_amount);
      // 예를 들어, SendMax에 있는 토큰 수량을 사용 (토큰 거래라면 객체, XRP 거래라면 그냥 수치)
      if (tx.tx_json.SendMax && typeof tx.tx_json.SendMax !== "string") {
        const sendMax = parseFloat(
          (tx.tx_json.SendMax as { value: string }).value
        );
        effectivePrice = delivered / sendMax;
      }
    }
    return { x: new Date(timestamp), y: effectivePrice };
  });
}

// 5. 메인 로직: 특정 토큰의 트랜잭션을 가져와서 그룹화 및 집계하고 차트 데이터로 변환
async function processTokenTransactions(tokenIssuer: string, account: string) {
  const txs = await fetchTransactions(account, -1, -1, 100);
  const grouped = groupTransactions(txs, tokenIssuer);

  // XRP 기반 거래 집계
  const xrpData = aggregateGroupData(grouped.A_XRP);
  // 다른 토큰 거래 집계 (각 토큰별)
  const otherData: Record<string, ChartDataPoint[]> = {};
  for (const currency in grouped.A_Other) {
    otherData[currency] = aggregateGroupData(grouped.A_Other[currency]);
  }

  return { xrpData, otherData };
}

// 6. 차트 라이브러리를 사용하여 데이터 표시 (예: ECharts, ApexCharts, FusionCharts 등)
// 여기서는 데이터를 콘솔에 출력하는 것으로 예시
processTokenTransactions(
  "rGG3wQ4kUzd7Jnmk1n5NWPZjjut62kCBfC",
  "r4bzgLA46rgTMBTewUQsyW4hXzsv4gmoUP"
)
  .then((result) => {
    console.log("XRP 거래 데이터:", result.xrpData);
    console.log("기타 토큰 거래 데이터:", result.otherData);
  })
  .catch(console.error);
