export interface ChainInfo {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  logo?: string;
}

export const CHAINS: ChainInfo[] = [
  {
    chainId: 101,
    chainName: "Solana",
    rpcUrl:
      "https://omniscient-intensive-pool.solana-mainnet.quiknode.pro/23356ce239e2d0a2ba72dbd60fe7f010ed26bac4/",
    logo: "/solana.svg",
  },
  {
    chainId: 1600,
    chainName: "XRPL",
    rpcUrl: "wss://s1.ripple.com/",
    logo: "/xrpl.svg",
  },
  {
    chainId: 1440002,
    chainName: "XRPL Side Chain",
    rpcUrl: "https://rpc-evm-sidechain.xrpl.org",
    logo: "/xrpl_sc.svg",
  },
  {
    chainId: 1,
    chainName: "Ethereum Mainnet",
    rpcUrl: "https://mainnet.infura.io/v3/…",
    logo: "/eth.svg",
  },
  {
    chainId: 56,
    chainName: "Binance Smart Chain",
    rpcUrl: "https://bsc-dataseed.binance.org/",
    logo: "/bsc.svg",
  },
  {
    chainId: 137,
    chainName: "Polygon",
    rpcUrl: "https://polygon-rpc.com/",
    logo: "/polygon.svg",
  },
];
