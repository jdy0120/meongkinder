const chargeAmount = (prize: number | undefined) => {
  if (!prize) return 0;
  const prizeAmount = (prize / 10000) * 0.197;
  return Math.floor(prizeAmount) * 10000;
};

const prizeAmount = (prize: number | undefined) => {
  if (!prize) return 0;
  return prize - chargeAmount(prize);
};

export { chargeAmount, prizeAmount };
