const LIMITLESS_FEE = 0.001; // 1%
const POLYMARKET_FEE = 0.0015; // 1.5%

function applyFees(amount, exchange, odds) {
  if (exchange === "LIMITLESS") {
    if (odds <= 0.5) {
      return amount * (1 + 0.03);
    } else if (odds <= 0.75) {
      return amount * (1 + 0.015);
    } else {
      return amount * (1 + 0.005);
    }
  }
  if (exchange === "POLYMARKET") {
    return amount * (1 + POLYMARKET_FEE);
  }
  return amount;
}

// Simulates arbitrage between two books
function simulateArbitrage(buyBook, hedgeBook, buyExchange, hedgeExchange, maxShares = Infinity) {

  if (!buyBook?.length || !hedgeBook?.length) {
    return { error: "Invalid order books", profit: 0 };
  }

  let optimisedYes = buyBook[buyBook.length - 1];
  let optimisedNo = hedgeBook[hedgeBook.length - 1];

  if (optimisedYes.price + optimisedNo.price >= 1) {
    return {
      error: "No arbitrage opportunity",
      reason: `Combined cost at depth: ${(optimisedYes.price + optimisedNo.price).toFixed(6)} >= 1.0000`,
      profit: 0,
    };
  }

  let mainEntry = optimisedYes.size > optimisedNo.size ? optimisedYes : optimisedNo;
  let mainExchange = optimisedYes.size > optimisedNo.size ? buyExchange : hedgeExchange;

  let loop = optimisedYes.size < optimisedNo.size ? buyBook : hedgeBook;
  let loopExchange = optimisedYes.size < optimisedNo.size ? buyExchange : hedgeExchange;

  console.log(`🔍 Reference side: ${mainExchange} (size: ${mainEntry.size.toLocaleString()}, price: $${mainEntry.price.toFixed(6)})`);
  console.log(`🔄 Iterating through: ${loopExchange} (${loop.length} levels)`);

  let bestProfit = -Infinity;
  let bestState = null;

  let prevEntry = {
    price: 0,
    size: 0,
    totalCost: 0,
  };

  for (let i = loop.length - 1; i >= 0; i--) {
    let entry = loop[i];
    let fillSize = prevEntry.size + entry.size;

    if (mainEntry.size < fillSize) {
      console.log(`⚠️  Stopping: fillSize ${fillSize.toLocaleString()} > mainEntry.size ${mainEntry.size.toLocaleString()}`);
      break;
    }

    let totalLoopCost = applyFees(prevEntry.totalCost + entry.size * entry.price, hedgeExchange ,entry.price );
    let mainCost = applyFees(mainEntry.price * fillSize, mainExchange);

    let totalCost = totalLoopCost + mainCost;

    let payout = fillSize;
    let profit = payout - totalCost;

    if (profit < 0) {
      console.log(`❌ Profit turned negative, stopping iteration`);
      break;
    }

    prevEntry = {
      price: fillSize > 0 ? totalLoopCost / fillSize : 0,
      size: fillSize,
      totalCost: totalLoopCost,
    };

    if (profit > bestProfit) {
      bestProfit = profit;
      bestState = {
        direction: `${buyExchange} BUY + ${hedgeExchange} HEDGE`,
        shares: fillSize,
        totalCost: totalCost,
        payout: payout,
        profit: profit,
        profitPercentage: (profit / payout) * 100,
        avgCostPerShare: fillSize > 0 ? totalCost / fillSize : 0,

        mainSide: {
          exchange: mainExchange,
          size: fillSize,
          price: mainEntry.price,
          cost: mainCost,
        },
        loopSide: {
          exchange: loopExchange,
          avgPrice: prevEntry.price,
          size: fillSize,
          cost: totalLoopCost,
          levelsUsed: loop.length - i,
        },
      };
    }
  }

  return (
    bestState || {
      error: "No profitable execution found",
      profit: 0,
      reason: "All tested sizes resulted in negative profit",
    }
  );
}

// Finds the best cross-market arbitrage (both directions)
function findBestCrossMarketArbitrage(polymarketBook, limitlessBook, maxShares = Infinity) {
  if (!polymarketBook || !limitlessBook) return null;

  // Normalize order books
  const polyYesBids = (polymarketBook.bids || []).map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
  const polyYesAsks = (polymarketBook.asks || []).map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));

  const limitYesBids = (limitlessBook.bids || []).map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }));
  const limitYesAsks = (limitlessBook.asks || []).map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })).reverse();

  const polyNoAsks = polyYesBids.map((b) => ({ price: 1 - b.price, size: b.size }));

  const limitNoAsks = limitYesBids.map((b) => ({ price: 1 - b.price, size: b.size })).reverse();

  // Run both directions
  const opp1 = simulateArbitrage([...polyYesAsks], [...limitNoAsks], "POLYMARKET", "LIMITLESS", maxShares); // Buy YES Poly, Hedge NO Limitless
  const opp2 = simulateArbitrage([...limitYesAsks], [...polyNoAsks], "LIMITLESS", "POLYMARKET", maxShares); // Buy YES Limitless, Hedge NO Poly

  if (!opp1 && !opp2) return null;
  if (!opp2 || (opp1 && opp1.profit > opp2.profit)) return opp1;
  return opp2;
}

// ====================================================================
// Integration with your bot
// ====================================================================

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

  const opp = findBestCrossMarketArbitrage(polymarketData.orderbook, limitlessData.orderbook, 1000);
  if (opp && opp.profit > 0) {
    recordArbitrage(bot, {
      pair_id: pairId,
      question: pair.question,
      direction: opp.direction,
      shares: opp.shares,
      total_cost: opp.totalCost,
      profit: opp.profit,
      profit_percentage: (opp.profit / opp.totalCost) * 100,
      avg_cost: opp.avgCost,
      timestamp: Date.now(),
    });
  }
}

function recordArbitrage(bot, opportunity) {
  bot.arbitrageCounter++;
  bot.arbitrageOpportunities.push(opportunity);
  console.log("═".repeat(100));
  console.log(`💰 INTER-PROTOCOL ARBITRAGE #${bot.arbitrageCounter} FOUND!`);
  console.log(`🔗 Direction: ${opportunity.direction}`);
  console.log(`📊 Market: ${opportunity.question}...`);
  console.log(
    `💵 Shares: ${opportunity.shares} | Total Cost: $${opportunity.total_cost.toFixed(4)} | Profit: $${opportunity.profit.toFixed(4)} (${opportunity.profit_percentage.toFixed(
      2
    )}%)`
  );
  console.log("═".repeat(100));
}

module.exports = { checkAllInterProtocolArbitrage, checkInterProtocolArbitrageForPair };
