import { Client, type AccountTxRequest } from "xrpl";
import { usePoolPriceState } from "../stores/usePoolState";

import type {
  payment,
  route,
  send,
  TokenInfo,
} from "../interfaces/transaction_interface";

const store = usePoolPriceState();
const chainId = 1440002;

export interface ChainModule {
  fetchAndProcessTx: (
    tokenAdd: string,
    options: { ledgerMin: string; ledgerMax: string; limit: number },
    rpc: string
  ) => Promise<void>;
}

function decode(add: string) {
  let str = "";
  for (let i = 0; i < add.length; i += 2) {
    const code = parseInt(add.substr(i, 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
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

function makedataset(
  tokenAdd: string,
  tx: any,
  isXRP: boolean,
  isBuy: boolean
) {
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
        const getCandleData = (
          open: any,
          close: any
        ): [number, number, number, number] => [
          open,
          close,
          Math.min(open, close),
          Math.max(open, close),
        ];
        const modifiedNode = nodeWrapper.ModifiedNode;
        const sendAmount =
          modifiedNode.PreviousFields.Balance -
          modifiedNode.FinalFields.Balance -
          tx.tx_json.Fee / 1000000;
        const deliveredAmount = Math.abs(tx.meta.delivered_amount.value);
        const effectiveRate = sendAmount / deliveredAmount;
        const poolId = "XRP";
        const beforePrice =
          store.getBeforePrice(chainId, tokenAdd, poolId) == 0
            ? effectiveRate
            : store.getBeforePrice(chainId, tokenAdd, poolId);
        const value = getCandleData(beforePrice, effectiveRate);
        const type = tx.tx_json.TransactionType;

        store.setBeforePrice(chainId, tokenAdd, poolId, effectiveRate);

        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount / 1000000,
          deliveredAmount: deliveredAmount,
          // offerSequence: sequences,
          // offerAmount: amounts,
        };
        store.addCandle(
          chainId,
          tokenAdd,
          poolId,
          [categoryData, value, type, tx],
          info
        );
      } else {
        //이 토큰으로 xrp를 구매한 경우
        const nodeWrapper = tx.meta.AffectedNodes?.find((node: any) => {
          const modified = node.ModifiedNode ?? node.DeletedNode;
          return (
            modified?.LedgerEntryType === "RippleState" &&
            modified.FinalFields &&
            ((modified.FinalFields.HighLimit.issuer === tx.tx_json.Account &&
              modified.FinalFields.LowLimit.issuer === tokenAdd) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd))
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
        const deliveredAmount =
          tx.meta.delivered_amount - tx.tx_json.Fee / 1000000;
        const effectiveRate = deliveredAmount / Math.abs(sendAmount);
        const poolId = "XRP";
        const beforePrice =
          store.getBeforePrice(chainId, tokenAdd, poolId) == 0
            ? effectiveRate
            : store.getBeforePrice(chainId, tokenAdd, poolId);
        const getCandleData = (
          open: any,
          close: any
        ): [number, number, number, number] => [
          open,
          close,
          Math.min(open, close),
          Math.max(open, close),
        ];
        const value = getCandleData(beforePrice, effectiveRate);
        const type = tx.tx_json.TransactionType;

        store.setBeforePrice(chainId, tokenAdd, poolId, effectiveRate);

        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount / 1000000,
          // offerSequence: sequences,
          // offerAmount: amounts,
        };
        store.addCandle(
          chainId,
          tokenAdd,
          poolId,
          [categoryData, value, type, tx],
          info
        );
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
              modified.FinalFields.LowLimit.issuer === tokenAdd) ||
              (modified.FinalFields.LowLimit.issuer === tx.tx_json.Account &&
                modified.FinalFields.HighLimit.issuer === tokenAdd))
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
        const poolId = `${tx.tx_json.SendMax.currency}_${tx.tx_json.SendMax.issuer}`;

        const beforePrice =
          store.getBeforePrice(chainId, tokenAdd, poolId) == 0
            ? effectiveRate
            : store.getBeforePrice(chainId, tokenAdd, poolId);
        const value: [number, number, number, number] = [
          beforePrice,
          effectiveRate,
          effectiveRate,
          beforePrice,
        ];
        const type = tx.tx_json.TransactionType;

        store.setBeforePrice(chainId, tokenAdd, poolId, effectiveRate);

        const info: payment = {
          keyType: "sell",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          // offerSequence: sequences,
          // offerAmount: amounts,
        };
        console.log("tokenAdd.value_sell", tokenAdd, poolId, tx);
        store.addCandle(
          chainId,
          tokenAdd,
          poolId,
          [categoryData, value, type, tx],
          info
        );
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
        const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
        const beforePrice =
          store.getBeforePrice(chainId, tokenAdd, poolId) == 0
            ? effectiveRate
            : store.getBeforePrice(chainId, tokenAdd, poolId);
        const value: [number, number, number, number] = [
          beforePrice,
          effectiveRate,
          beforePrice,
          effectiveRate,
        ];
        const type = tx.tx_json.TransactionType;
        store.setBeforePrice(chainId, tokenAdd, poolId, effectiveRate);
        const info: payment = {
          keyType: "buy",
          account: tx.tx_json.Account,
          fee: tx.tx_json.Fee / 1000000,
          sendAmount: sendAmount,
          deliveredAmount: deliveredAmount,
          // offerSequence: sequences,
          // offerAmount: amounts,
        };
        store.addCandle(
          chainId,
          tokenAdd,
          poolId,
          [categoryData, value, type, tx],
          info
        );
      }
    }
  } catch (e) {
    console.log("error: ", e, tx);
  }
}

async function formatData(tokenAdd: string, txs: any[]) {
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
            if (meta.delivered_amount.issuer === tokenAdd) {
              // const tokenMap = getOrCreateTokenMap(
              //   meta.delivered_amount.currency
              // );
              makedataset(tokenAdd, tx, true, true);

              // console.log("xrp로 구매");
              //받는 토큰이 tokenAddress임 -> currency도 나중에 처리하게 수정해야함
            } else {
              // console.log("xrp를 보냈는데 받은 토큰이 tokenAddress가 아님: ");
              const categoryData = formatDate(tx.tx_json.date);
              const poolId = `${tx.meta.delivered_amount.currency}_${tx.meta.delivered_amount.issuer}`;
              const beforePrice = store.getBeforePrice(
                chainId,
                tokenAdd,
                poolId
              );
              const value: [number, number, number, number] = [
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
              store.addCandle(
                chainId,
                tokenAdd,
                poolId,
                [categoryData, value, type, tx],
                info
              );
            }
          } else if (tx_json?.SendMax?.issuer === tokenAdd) {
            //받은 토큰이 XRP
            if (typeof meta.delivered_amount === "string") {
              makedataset(tokenAdd, tx, true, false);
              // console.log("토큰 판매 후 XRP 받음");
            } else {
              makedataset(tokenAdd, tx, false, true);
              // console.log("이 토큰으로 다른 토큰 구매:  ");
            }
          } else if (meta.delivered_amount.issuer === tokenAdd) {
            //다른 토큰에서 현재 토큰으로 변환
            makedataset(tokenAdd, tx, false, false);
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
      }
      // else if (type == "OfferCreate") {
      //   const categoryData = formatDate(tx.tx_json.date);
      //   const info = parseTx(tx);
      //   const poolId = calculatePoolId(tokenAdd, info);
      //   addOfferDatas(tokenAdd.value, poolId, tx, categoryData, info);
      // }
      // else if (type == "OfferCancel") {
      //   if (isNotExistingOfferCreate(tx.tx_json?.OfferSequence)) {
      //     continue;
      //   }
      //   const categoryData = formatDate(tx.tx_json.date);
      //   const info = parseTx(tx);
      //   const poolId = getPoolId(info.offerSequence);
      //   addOfferDatas(tokenAdd.value, poolId, tx, categoryData, info);
      // }
    } catch (e) {
      console.log("error", e, tx);
    }
  }
}

export const xrplModule: ChainModule = {
  async fetchAndProcessTx(
    tokenAdd,
    { ledgerMin, ledgerMax, limit },
    rpc: string
  ) {
    const client = new Client(rpc);
    await client.connect();

    try {
      await client.connect();
      const account = tokenAdd;

      // resetAllTokenData();
      // const inputState = getPoolData(tokenAdd.value, account);
      // console.log("inputState", inputState);
      // const storedTxs = inputState ? inputState.tx : [];
      // if (storedTxs.length > 0) {
      //   const latestTx = storedTxs[storedTxs.length - 1];
      //   ledgerMin.value = latestTx.tx_json.ledger_index + 1;
      // } else {
      //   ledgerMin.value = -1;
      // }

      let allTxs: any[] = [];
      if (limit === 0) {
        let marker: string | undefined = undefined;
        do {
          const request: AccountTxRequest = {
            command: "account_tx",
            account,
            ledger_index_max: parseInt(ledgerMax),
            ledger_index_min: parseInt(ledgerMin),
            limit: limit,
            ...(marker ? { marker } : {}),
          };

          const response = await client.request(request);
          const txs = response.result.transactions;
          allTxs = allTxs.concat(txs);
          marker = response.result.marker as string | undefined;
        } while (marker);
      } else {
        const request: AccountTxRequest = {
          command: "account_tx",
          account,
          ledger_index_max: parseInt(ledgerMax),
          ledger_index_min: parseInt(ledgerMin),
          limit: limit,
        };
        const response = await client.request(request);
        allTxs = response.result.transactions;
        console.log("allTxs 개수:", allTxs.length);
      }

      //발행자 주소로 입력했을 경우 확인하는 용도
      const gate_response = await client.request({
        command: "gateway_balances",
        account,
      });
      const obligations = gate_response.result.obligations;
      if (obligations && Object.keys(obligations).length === 1) {
        const currencyHex = Object.keys(obligations)[0];
        // currency = decode(currencyHex);
        await formatData(tokenAdd, allTxs);
      } else {
        // await formataData_multy(allTxs);
      }
    } catch (e) {
      console.log(e);
      alert("트랜잭션 조회 중 오류 발생");
    }

    await client.disconnect();
  },
};
