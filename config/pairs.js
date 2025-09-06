const { getLimitlessConfigFromSlug } = require("../src/exchanges/limitless");
const { getPolymarketConfigFromSlug } = require("../src/exchanges/polymarket");

const crossMarketPairs = [
  {
    pair_id: "will-trump-be-impeached-in-2025-1749202269972",
    question:  "will-trump-be-impeached-in-2025-1749202269972",
    polymarket: {
      market_id: "0xb608cf26e1081629f346a99372add130b2b97e7ff74d8396c5cba79e66e4c3bb",
      yes_token_id: "18052230577606093248149969614868413514328621185619579841964821235308576641973",
    },
    limitless: {
      market_id: "will-trump-be-impeached-in-2025-1749202269972",
      yes_token_id: "27429618883841612275431567812088876832741363341434003499623168003306183194396",
    },
  },
];


const slugPairs = [
//   {
//     limitless: "us-stagflation-in-2025-1744723334416",
//     polymarket: "us-stagflation-in-2025",
//   },
];

async function buildMarketPairs() {
    const results = [];
  
    for (const slug of slugPairs) {
      try {
        const [polyConfig, limitConfig] = await Promise.all([
          getPolymarketConfigFromSlug(slug.polymarket),
          getLimitlessConfigFromSlug(slug.limitless),
        ]);
  
        results.push({
          pair_id: slug,
          question: slug,
          polymarket: polyConfig,
          limitless: limitConfig,
        });
      } catch (err) {
        console.error(`❌ Failed to build market pair for slug: ${slug}`, err.message);
      }
    }
  
    return [...crossMarketPairs , ...results];
  }

module.exports = { crossMarketPairs , buildMarketPairs};
