const axios = require("axios");

const LIMITLESS_API_BASE = "https://api.limitless.exchange/markets";

async function initialLimitlessDataFetch(bot) {
  console.log("📡 Fetching initial Limitless data...");
  const promises = [];
  bot.crossMarketPairs.forEach((pair) => {
    promises.push(fetchLimitlessTokenPrice(bot, pair.limitless.market_id));
  });
  await Promise.allSettled(promises);
}

function startLimitlessPeriodicUpdate(bot) {
  setInterval(async () => {
    const promises = [];
    bot.crossMarketPairs.forEach((pair) => {
      promises.push(fetchLimitlessTokenPrice(bot, pair.limitless.market_id));
    });
    await Promise.allSettled(promises);
  }, 5000);
}

async function fetchLimitlessTokenPrice(bot, tokenId) {
  try {
    const priceData = await getLimitlessTokenPrice(tokenId);
    if (priceData) {
      bot.limitlessData.set(priceData.tokenId, {
        protocol: "limitless",
        asset_id: priceData.tokenId,
        yes_price: priceData.yes_price,
        no_price: parseFloat(1 - priceData.no_price),
        best_bid: priceData.bid || 0,
        best_ask: priceData.ask || 0,
        orderbook: { bids: priceData.bids, asks: priceData.asks },
        last_updated: Date.now(),
      });
    }
  } catch (err) {
    console.error(`❌ Error fetching Limitless token:`, err.message);
  }
}

async function getLimitlessTokenPrice(tokenId) {
  try {
    const url = `${LIMITLESS_API_BASE}/${tokenId}/orderbook`;
    const { data: result } = await axios.get(url);

    const bestBid = result.bids?.length ? parseFloat(result.bids[0].price) : 0;
    const bestAsk = result.asks?.length ? parseFloat(result.asks[0].price) : 0;

    return { yes_price: bestAsk, no_price: bestBid, tokenId: result.tokenId, bids: result.bids, asks: result.asks };
  } catch (err) {
    console.error(`❌ Axios fetch error for ${tokenId}:`, err.message);
    throw err;
  }
}

async function getLimitlessConfigFromSlug(slug) {
  const url = `${LIMITLESS_API_BASE}/${slug}`;

  const { data } = await axios.get(url);
  const yes_token_id = data.tokens.yes;

  return {
    market_id: slug,
    yes_token_id,
  };
}

module.exports = { initialLimitlessDataFetch, startLimitlessPeriodicUpdate, fetchLimitlessTokenPrice, getLimitlessConfigFromSlug };
