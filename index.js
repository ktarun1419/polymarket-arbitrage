const { InterProtocolArbitrageBot } = require("./src/bot");

const { buildMarketPairs } = require("./config/pairs");

async function main() {
 
  const crossMarketPairs = await buildMarketPairs();


  const bot = new InterProtocolArbitrageBot(crossMarketPairs);

  try {
    await bot.start();

    setInterval(() => {
      const stats = bot.getStats();
      console.log(
        `\n📊 LIVE STATS - Runtime: ${stats.runtime_hours.toFixed(2)}h | Opportunities: ${stats.total_opportunities} | Profit: $${stats.total_potential_profit.toFixed(4)}`
      );
    }, 60000);
  } catch (error) {
    console.error("❌ Bot startup error:", error);
    process.exit(1);
  }
}

main();
