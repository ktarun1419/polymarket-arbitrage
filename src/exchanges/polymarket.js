const WebSocket = require("ws");
const { fetchLimitlessTokenPrice } = require("./limitless");
const { checkAllInterProtocolArbitrage, checkInterProtocolArbitrageForPair } = require("../arbitrage");
const { default: axios } = require("axios");

const POLYMARKET_WSS = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const API_URL = "https://gamma-api.polymarket.com";

async function connectPolymarket(bot) {
  return new Promise((resolve, reject) => {
    bot.polymarketWS = new WebSocket(POLYMARKET_WSS);

    bot.polymarketWS.on("open", () => {
      console.log("✅ Connected to Polymarket WebSocket");
      resolve();
    });

    bot.polymarketWS.on("message", (data) => {
      try {
        const events = JSON.parse(data.toString());
        if (Array.isArray(events)) {
          events.forEach((event) => handlePolymarketEvent(bot, event));
        }
      } catch (err) {
        console.error("❌ Polymarket message error:", err);
      }
    });

    bot.polymarketWS.on("error", reject);
    bot.polymarketWS.on("close", () => {
      console.log("🔌 Polymarket WebSocket closed");
      if (bot.isRunning) setTimeout(() => connectPolymarket(bot), 5000);
    });
  });
}

async function subscribeToPolymarket(bot) {
  if (!bot.polymarketWS || bot.polymarketWS.readyState !== WebSocket.OPEN) return;
  const tokenIds = [];
  bot.crossMarketPairs.forEach((pair) => tokenIds.push(pair.polymarket.yes_token_id));

  bot.polymarketWS.send(JSON.stringify({ type: "MARKET", assets_ids: tokenIds, auth: {} }));
  console.log(`📡 Subscribed to ${tokenIds.length} Polymarket tokens`);
}

async function onPolymarketUpdate(bot, polyTokenId) {
  // Find the corresponding Limitless tokens for this Polymarket token
  for (const [pairId, pair] of bot.crossMarketPairs) {
    if (pair.polymarket.yes_token_id === polyTokenId) {
      // Update both YES and NO tokens for this market pair
      await fetchLimitlessTokenPrice(bot, pair.limitless.market_id);

      // Check for arbitrage opportunities
      checkInterProtocolArbitrageForPair(bot, pairId, pair);
      break;
    }
  }
}

function handlePolymarketEvent(bot, event) {
  if (event.event_type === "book") {
    const { asset_id, bids, asks, timestamp } = event;
    const bestBid = bids?.length ? parseFloat(bids[bids.length - 1].price) : 0;
    const bestAsk = asks?.length ? parseFloat(asks[asks.length - 1].price) : 0;

    bot.polymarketData.set(asset_id, {
      protocol: "polymarket",
      asset_id,
      yes_price: bestAsk,
      no_price: parseFloat(1 - bestBid),
      best_bid: bestBid,
      best_ask: bestAsk,
      last_updated: Date.now(),
    });
    onPolymarketUpdate(bot, asset_id);
  }
}

async function getPolymarketConfigFromSlug(slug) {
  if (!slug) return;
  const url = `${API_URL}/markets/slug/${slug}`;
  const { data } = await axios.get(url);
  let tokenIds = JSON.parse(data.clobTokenIds);
  return {
    market_id: data.conditionId,
    yes_token_id: Array.isArray(tokenIds) ? tokenIds[0] : "",
  };
}

module.exports = { connectPolymarket, subscribeToPolymarket, getPolymarketConfigFromSlug };
