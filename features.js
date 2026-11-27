(function () {
  const storageKey = 'urban-dash-progress-v1';
  const today = new Date().toISOString().slice(0, 10);
  const base = { coins: 0, stars: 0, lastReward: '', upgrades: { speed: 1, magnet: 1, air: 1, shield: 1 }, outfits: ['teal-runner'], selectedOutfit: 'teal-runner', missions: { diamonds: 0, distance: 0, boosts: 0, tunnels: 0 }, weeklyDistance: 0, best: { score: 0, distance: 0, diamonds: 0, combo: 0, speed: 0 } };
  let data = base;
  try { data = Object.assign({}, base, JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch (_) {}
  data.upgrades = Object.assign({}, base.upgrades, data.upgrades);
  data.missions = Object.assign({}, base.missions, data.missions);
  data.best = Object.assign({}, base.best, data.best);
  const save = () => localStorage.setItem(storageKey, JSON.stringify(data));
  window.urbanDashFeatures = { data, save, claimDailyReward() { if (data.lastReward === today) return false; data.lastReward = today; data.coins += 100; data.stars += 1; save(); return true; }, recordRun(run) { data.best.score = Math.max(data.best.score, run.score || 0); data.best.distance = Math.max(data.best.distance, run.distance || 0); data.best.diamonds = Math.max(data.best.diamonds, run.diamonds || 0); data.best.combo = Math.max(data.best.combo, run.combo || 0); data.best.speed = Math.max(data.best.speed, run.speed || 0); data.coins += Math.max(10, Math.floor((run.distance || 0) / 25)); data.weeklyDistance += run.distance || 0; save(); } };
  window.urbanDashFeatures.claimDailyReward();
})();
