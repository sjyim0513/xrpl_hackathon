import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";

export interface ChainModule {
  fetchAndProcessTx: (
    tokenAdd: string,
    options: { ledgerMin: string; ledgerMax: string; limit: number },
    rpc: string
  ) => Promise<void>;
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

export const solModule: ChainModule = {
  async fetchAndProcessTx(tokenAdd, { ledgerMin, ledgerMax, limit }, rpc) {
    try {
      console.log("rpc", rpc, tokenAdd, limit);

      const connection = new Connection(rpc);
      const sigkey = new PublicKey(tokenAdd);
      const MAX_CHUNK = 1000;
      let before: string | undefined = undefined;
      const allSignatures: ConfirmedSignatureInfo[] = [];

      while (true) {
        // limit>0 이면 남은 개수; 아니면 MAX_CHUNK
        const remaining = limit > 0 ? limit - allSignatures.length : Infinity;
        if (remaining <= 0) break;

        const batchSize = Math.min(remaining, MAX_CHUNK);
        const batch = await connection.getSignaturesForAddress(sigkey, {
          before,
          limit: batchSize,
        });

        if (batch.length === 0) break;

        allSignatures.push(...batch);
        before = batch[batch.length - 1].signature;
      }

      const transactions = [];
      const BATCH_SIZE = 100;

      for (let i = 0; i < allSignatures.length; i += BATCH_SIZE) {
        const chunk = allSignatures
          .slice(i, i + BATCH_SIZE)
          .map((s) => s.signature);
        const fetched = await Promise.all(
          chunk.map((sig) =>
            connection.getParsedTransaction(sig, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            })
          )
        );
        // null 필터링
        transactions.push(...fetched.filter((tx) => tx !== null));
      }

      console.dir(transactions);
    } catch (e) {
      console.error("error", e);
    }
  },
};
