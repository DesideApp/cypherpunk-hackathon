export {};

declare global {
  interface Window {
    phantom?: { solana?: any };
    backpack?: any;
    solana?: any;
    solflare?: any;
    magicEden?: any;
  }
}
