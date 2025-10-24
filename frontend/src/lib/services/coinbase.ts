// Coinbase API service for fetching BTC price (CORS-friendly)
export interface CoinbasePrice {
  data: {
    amount: string;
    currency: string;
  };
}

export async function fetchBTCPrice(): Promise<number> {
  const response = await fetch(
    'https://api.coinbase.com/v2/prices/BTC-USD/spot'
  );

  if (!response.ok) {
    throw new Error(`Coinbase API error: ${response.statusText}`);
  }

  const data: CoinbasePrice = await response.json();
  return parseFloat(data.data.amount);
}
