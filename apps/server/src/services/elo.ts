export interface EloResult {
  newRatingA: number;
  newRatingB: number;
  expectedA: number;
  expectedB: number;
}

export function updateElo(ratingA: number, ratingB: number, outcomeA: 0 | 0.5 | 1, k: number = 32): EloResult {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  const newRatingA = Math.round(ratingA + k * (outcomeA - expectedA));
  const newRatingB = Math.round(ratingB + k * ((1 - outcomeA) - expectedB));

  return { newRatingA, newRatingB, expectedA, expectedB };
}
