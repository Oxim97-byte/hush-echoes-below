// HUSH — Echoes Below. The silent streak: pearls taken while no
// hunter is hunting build a score multiplier, one step per pearl, up
// to the cap. The moment anything hunts — or a pearl is taken while
// hunted — the streak breaks. Silence is the risk, the streak is the
// reward: bold, quiet diving pays, noisy diving pays the base rate.
export class SilentStreak {
  constructor(maxMultiplier) {
    this.maxMultiplier = maxMultiplier;
    this.streak = 0; // silent pearls in a row
    this.best = 0; // best streak this run
  }

  // Multiplier from the streak: x1 with no streak, up to the cap.
  get multiplier() {
    return Math.min(1 + this.streak, this.maxMultiplier);
  }

  // A pearl taken while nothing hunts: streak grows, points multiply.
  onSilentPearl(pearlScore, silentBonus) {
    this.streak++;
    if (this.streak > this.best) this.best = this.streak;
    return (pearlScore + silentBonus) * this.multiplier;
  }

  // A pearl taken while hunted: base points only, streak gone.
  onNoisyPearl(pearlScore) {
    this.streak = 0;
    return pearlScore;
  }

  // A hunter starts hunting: the streak breaks at once.
  breakStreak() {
    this.streak = 0;
  }

  reset() {
    this.streak = 0;
    this.best = 0;
  }
}
