function checkAllInterProtocolArbitrage(bot) {
  bot.crossMarketPairs.forEach((pair, pairId) => {
    checkInterProtocolArbitrageForPair(bot, pairId, pair);
  });
}

function checkInterProtocolArbitrageForPair(bot, pairId, pair) {
  const polymarketData = bot.polymarketData.get(pair.polymarket.yes_token_id);
  const limitlessData = bot.limitlessData.get(pair.limitless.yes_token_id);

  if (!polymarketData || !limitlessData) return;

  const maxAge = 30000;
  const now = Date.now();

  if (now - polymarketData.last_updated > maxAge || now - limitlessData.last_updated > maxAge) {
    return;
  }
  console.log("checking direction......");

  checkArbitrageDirection1(bot, pairId, pair, polymarketData.yes_price, limitlessData.no_price);
  checkArbitrageDirection2(bot, pairId, pair, polymarketData.no_price, limitlessData.yes_price);
}

function checkArbitrageDirection1(bot, pairId, pair, polyYes, limitNo) {
  if (!polyYes || !limitNo) return;
  const totalCost = polyYes + limitNo;
  const profit = 1.0 - totalCost;

  if (profit > 0.01 && totalCost < 1.0 && totalCost > 0.1) {
    recordArbitrage(bot, {
      pair_id: pairId,
      question: pair.question,
      direction: 1,
      description: "YES on Polymarket + NO on Limitless",
      buy_poly_yes: polyYes,
      buy_limit_no: limitNo,
      total_cost: totalCost,
      profit,
      profit_percentage: profit * 100,
      timestamp: Date.now(),
    });
  }
}

function checkArbitrageDirection2(bot, pairId, pair, polyNo, limitYes) {
  if (!polyNo || !limitYes) return;
  const totalCost = polyNo + limitYes;
  const profit = 1.0 - totalCost;

  if (profit > 0.01 && totalCost < 1.0 && totalCost > 0.1) {
    recordArbitrage(bot, {
      pair_id: pairId,
      question: pair.question,
      direction: 2,
      description: "NO on Polymarket + YES on Limitless",
      buy_poly_no: polyNo,
      buy_limit_yes: limitYes,
      total_cost: totalCost,
      profit,
      profit_percentage: profit * 100,
      timestamp: Date.now(),
    });
  }
}

function recordArbitrage(bot, opportunity) {
  bot.arbitrageCounter++;
  bot.arbitrageOpportunities.push(opportunity);
  console.log("═".repeat(100));
  console.log(`💰 INTER-PROTOCOL ARBITRAGE #${bot.arbitrageCounter} FOUND!`);
  console.log(`🔗 Direction: ${opportunity.description}`);
  console.log(`📊 Market: ${opportunity.question}...`);
  console.log(`💵 Total Cost: $${opportunity.total_cost.toFixed(4)} | Profit: $${opportunity.profit.toFixed(4)} (${opportunity.profit_percentage.toFixed(2)}%)`);
  console.log("═".repeat(100));
}

module.exports = { checkAllInterProtocolArbitrage, checkInterProtocolArbitrageForPair };
