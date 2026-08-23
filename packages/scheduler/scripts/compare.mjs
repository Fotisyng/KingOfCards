import { AllSchedulers, runComparison } from "../dist/index.js";

const LEARNER_CONFIG = {
  recallGrowthFactor: 2.0,
  forgetDecayFactor: 0.6,
  minTrueHalfLifeDays: 1.0,
};
const SEEDS = [1, 2, 3];
const CARD_COUNT = 500;
const HORIZONS_DAYS = [90, 365];

for (const horizonDays of HORIZONS_DAYS) {
  console.log(`\n=== horizon: ${horizonDays} days (${CARD_COUNT} synthetic cards/seed) ===`);
  for (const seed of SEEDS) {
    console.log(`--- seed ${seed} ---`);
    for (const scheduler of AllSchedulers) {
      const result = runComparison(scheduler, {
        cardCount: CARD_COUNT,
        horizonDays,
        seed,
        initialTrueHalfLifeDays: 1,
        learnerConfig: LEARNER_CONFIG,
      });
      const reviewsPerCard = result.averageReviewsPerCard.toFixed(2).padStart(6);
      const retention = (result.empiricalRetention * 100).toFixed(2).padStart(6);
      console.log(
        `  ${result.schedulerId.padEnd(6)} reviews/card=${reviewsPerCard}  retention=${retention}%  totalReviews=${result.totalReviews}`,
      );
    }
  }
}
