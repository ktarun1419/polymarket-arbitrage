const { connectPolymarket, subscribeToPolymarket } = require("./exchanges/polymarket");
const { initialLimitlessDataFetch, startLimitlessPeriodicUpdate } = require("./exchanges/limitless");
const { checkAllInterProtocolArbitrage } = require("./arbitrage");
const { setupGracefulShutdown } = require("./utils/logger");

class InterProtocolArbitrageBot {
  constructor(crossMarketPairs) {
    this.polymarketData = new Map();
    this.limitlessData = new Map();
    this.crossMarketPairs = new Map();
    this.arbitrageOpportunities = [];
    this.startTime = 0;
    this.isRunning = false;
    this.arbitrageCounter = 0;

    // Load pairs
    crossMarketPairs.forEach((pair) => this.crossMarketPairs.set(pair.pair_id, pair));

    setupGracefulShutdown(this);
  }

  async start() {
    if (this.crossMarketPairs.size === 0) {
      console.log("❌ No cross-market pairs configured.");
      return;
    }

    console.log("🚀 Starting Inter-Protocol Arbitrage Bot...");
    this.startTime = Date.now();
    this.isRunning = true;

    await connectPolymarket(this);
    await subscribeToPolymarket(this);

    await initialLimitlessDataFetch(this);

    startLimitlessPeriodicUpdate(this);

    // setInterval(() => checkAllInterProtocolArbitrage(this), 5000);
  }

  getStats() {
    const runTime = Date.now() - this.startTime;
    const totalProfit = this.arbitrageOpportunities.reduce((sum, opp) => sum + opp.profit, 0);

    return {
      runtime_hours: runTime / (1000 * 60 * 60),
      cross_market_pairs: this.crossMarketPairs.size,
      polymarket_tokens: this.polymarketData.size,
      limitless_tokens: this.limitlessData.size,
      total_opportunities: this.arbitrageOpportunities.length,
      total_potential_profit: totalProfit,
    };
  }

  stop() {
    this.isRunning = false;
    if (this.polymarketWS) this.polymarketWS.close();
  }
}

module.exports = { InterProtocolArbitrageBot };
