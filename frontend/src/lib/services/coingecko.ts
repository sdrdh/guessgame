// CoinGecko API service for fetching BTC price
export interface CoinGeckoPrice {
  bitcoin: {
    usd: number;
  };
}

export async function fetchBTCPrice(): Promise<number> {
  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.statusText}`);
  }

  const data: CoinGeckoPrice = await response.json();
  return data.bitcoin.usd;
}
