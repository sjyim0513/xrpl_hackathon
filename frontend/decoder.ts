import { TokenInstruction } from "@solana/spl-token";
import bs58 from "bs58";
const dataString = "1GsxhWNYyfq2w2RhmgHk56w";
const raw = bs58.decode("1GsxhWNYyfq2w2RhmgHk56w"); // Buffer
const buf = bs58.decode(dataString);
const instrTag = buf[0];
if (instrTag === 3) {
  const amount = buf.readBigUInt64LE(1);
  console.log("Transfer instruction, amount =", amount.toString());
} else {
  console.log("다른 instruction:", instrTag);
}
