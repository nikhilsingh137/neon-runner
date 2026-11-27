(function () {
  const storageKey = 'urban-dash-progress-v2';
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date().getUTCFullYear() + '-W' + Math.ceil((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 604800000);
  const base = { coins: 0, stars: 0, lastReward: '', week: '', upgrades: { speed: 1, magnet: 1, air: 1, shield: 1, jump: 1 }, outfits: ['teal-runner'], selectedOutfit: 'teal-runner', missions: { diamonds: 0, distance: 0, boosts: 0, tunnels: 0, stations: 0 }, claimed: [], weeklyDistance: 0, best: { score: 0, distance: 0, diamonds: 0, combo: 0, speed: 0 }, runs: [] };
  let data = base;
  try { data = Object.assign({}, base, JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch (_) {}
  data.upgrades = Object.assign({}, base.upgrades, data.upgrades);
  data.missions = Object.assign({}, base.missions, data.missions);
  data.best = Object.assign({}, base.best, data.best);
  data.outfits = data.outfits || base.outfits;
  data.claimed = data.claimed || [];
  data.runs = data.runs || [];
  if (data.week !== week) { data.week = week; data.weeklyDistance = 0; }
  const missionDefs = [
    ['diamonds', 'Collect 50 diamonds', 50, 250],
    ['distance', 'Run 500 meters', 500, 250],
    ['boosts', 'Use 3 boosts', 3, 200],
    ['tunnels', 'Pass through 2 tunnels', 2, 300],
    ['stations', 'Reach 3 stations safely', 3, 350]
  ];
  const save = () => localStorage.setItem(storageKey, JSON.stringify(data));
  const notify = (message) => window.dispatchEvent(new CustomEvent('urban-dash-toast', { detail: message }));
  function updateMissionCard() {
    const card = document.getElementById('run-mission-card');
    if (!card) return;
    const active = missionDefs.find(([name, , target]) => data.missions[name] < target);
    if (!active) { card.innerHTML = '<span class="mission-kicker">MISSIONS COMPLETE</span><strong>City champion!</strong><span class="mission-progress">Choose a new run</span>'; return; }
    const [name, label, target, reward] = active;
    card.innerHTML = `<span class="mission-kicker">TODAY’S RUN</span><strong>${label}</strong><span class="mission-progress">${Math.min(Math.floor(data.missions[name]),target)} / ${target} · Reward +${reward}</span>`;
  }
  function updateJourney() {
    const wallet=document.getElementById('feature-wallet');
    if(wallet) wallet.textContent=data.coins.toLocaleString();
    const panel = document.querySelector('.progression-panel');
    if (panel) {
      panel.querySelectorAll('.upgrade-row span').forEach((item,index) => {
        const names=['speed','magnet','air'];
        item.textContent = item.textContent.replace(/LV \d+/, 'LV ' + data.upgrades[names[index]]);
      });
      panel.querySelector('.progression-heading b')?.replaceChildren('BEST DISTANCE ' + Math.floor(data.best.distance) + ' M');
    }
    document.querySelectorAll('.zone-card').forEach((card,index) => {
      const thresholds=[0,2000,5000,8000,12000,16000];
      const unlocked=data.best.distance>=thresholds[index];
      card.classList.toggle('active',unlocked && data.best.distance < thresholds[index+1]);
      const note=card.querySelector('small');
      if(note) note.textContent=unlocked?'UNLOCKED':`UNLOCK AT ${thresholds[index].toLocaleString()} M`;
    });
  }
  function addMission(name, amount) {
    if (!(name in data.missions)) return;
    const def = missionDefs.find(item => item[0] === name);
    const previous = data.missions[name];
    const wasDone = data.missions[name] >= def[2];
    data.missions[name] += amount;
    const completed = !wasDone && data.missions[name] >= def[2];
    if (name === 'distance' && !completed && Math.floor(previous / 25) === Math.floor(data.missions[name] / 25)) return;
    if (completed && !data.claimed.includes(name)) {
      data.claimed.push(name); data.coins += def[3]; notify('MISSION COMPLETE  +' + def[3] + ' COINS');
    }
    save();
    updateMissionCard();
  }
  const api = window.urbanDashFeatures = {
    data, missionDefs, addMission, save,
    claimDailyReward() { if (data.lastReward === today) return false; data.lastReward = today; data.coins += 100; data.stars += 1; save(); return true; },
    upgrade(name) { const level = data.upgrades[name] || 1; const cost = level * 150; if (level >= 5 || data.coins < cost) return false; data.coins -= cost; data.upgrades[name] = level + 1; save(); return true; },
    unlockOutfit(name, cost) { if (data.outfits.includes(name) || data.coins < cost) return false; data.coins -= cost; data.outfits.push(name); save(); return true; },
    selectOutfit(name) { if (!data.outfits.includes(name)) return false; data.selectedOutfit = name; save(); window.dispatchEvent(new CustomEvent('urban-dash-outfit', { detail: name })); return true; },
    recordRun(run) {
      for (const [key, value] of Object.entries({ score: run.score, distance: run.distance, diamonds: run.diamonds, combo: run.combo, speed: run.speed })) data.best[key] = Math.max(data.best[key] || 0, value || 0);
      const reward = Math.max(10, Math.floor((run.distance || 0) / 25)) + Math.floor((run.diamonds || 0) / 5);
      data.coins += reward; data.weeklyDistance += run.distance || 0;
      data.runs.unshift({ ...run, reward, date: today }); data.runs.length = Math.min(data.runs.length, 20); save();
      updateJourney();
      const screen = document.getElementById('game-over-screen');
      if (screen) {
        let summary = document.getElementById('run-reward-summary');
        if (!summary) { summary = document.createElement('div'); summary.id = 'run-reward-summary'; summary.className = 'run-reward-summary'; screen.append(summary); }
        summary.innerHTML = `<strong>RUN REWARDS  +${reward} COINS</strong><span>${Math.floor(run.distance || 0)} m · ${run.diamonds || 0} diamonds · ${run.combo || 0} combo</span><span>Weekly journey ${Math.floor(data.weeklyDistance)} / 3,000 m</span>`;
      }
      return reward;
    },
    claimWeekly() { if (data.weeklyDistance < 3000 || data.weeklyClaimed === week) return false; data.weeklyClaimed = week; data.stars += 3; data.coins += 500; save(); return true; }
  };
  const dailyClaimed = api.claimDailyReward();
  save();

  function openFeature(key) {
    const detail = document.getElementById('feature-detail');
    if (!detail) return;
    const content = {
      story: ['Kai’s Last Metro', 'Race through six city districts and reach Grand Central before the final train departs. Every run moves the city journey forward.'],
      mission: ['Missions', missionDefs.map(([name, label, target, reward]) => `${label} — ${Math.min(data.missions[name], target)} / ${target} · ${data.claimed.includes(name) ? 'CLAIMED' : '+' + reward + ' coins'}`).join('<br>')],
      reward: ['Daily Rewards', dailyClaimed ? 'Today’s welcome gift has been added: 100 coins and 1 star.' : 'Today’s reward is already claimed. Come back tomorrow for 100 coins and 1 star.'],
      upgrade: ['Runner Upgrades', ['speed','magnet','jump','air','shield'].map(name => `<button class="detail-action" data-upgrade="${name}">Upgrade ${name} · Lv ${data.upgrades[name]} · ${data.upgrades[name]*150} coins</button>`).join('')],
      outfit: ['Outfits', ['teal-runner','neon-hoodie','metro-guard','festival','night-runner','royal-blue'].map((name,i) => `<button class="detail-action" data-outfit="${name}" data-cost="${i ? 300+i*100 : 0}">${data.outfits.includes(name) ? (data.selectedOutfit===name?'✓ Wearing ':'Wear ') : 'Unlock '}${name.replaceAll('-',' ')}${i && !data.outfits.includes(name) ? ' · '+(300+i*100)+' coins' : ''}</button>`).join('')],
      zones: ['City Journey', 'Sunset City → Night Metro → Rain Station → Festival Street → Sky Bridge → Underground Tunnel → Grand Central. Reach 2,000 m, 5,000 m, 8,000 m, 12,000 m, and 16,000 m to unlock the next district.'],
      event: ['Station Events', 'Stations can host crowds, performers, moving trains, shops, flashing signs, and neon advertisements. Watch the track and time each move.'],
      stats: ['Personal Bests', `Highest score ${data.best.score} · Longest run ${Math.floor(data.best.distance)} m · Most diamonds ${data.best.diamonds} · Best combo ${data.best.combo} · Fastest ${Math.floor(data.best.speed*1.2)} km/h`],
      weekly: ['Weekly Challenge', `Run 3,000 meters this week to earn 3 stars and 500 coins. Progress ${Math.min(3000,Math.floor(data.weeklyDistance))} / 3,000 m.<br><button class="detail-action" data-claim-weekly>Claim weekly reward</button>`],
      leaderboard: ['Local Leaderboards', `Highest score ${data.best.score}<br>Longest distance ${Math.floor(data.best.distance)} m<br>Best combo ${data.best.combo}<br>Most diamonds ${data.best.diamonds}<br>Fastest run ${Math.floor(data.best.speed*1.2)} km/h`],
      tutorial: ['Quick Tutorial', 'Swipe left or right to change lanes. Swipe up to jump over barriers. Swipe down to slide under signs. Collect boosts on the track. During parachute flight, steer toward the floating diamonds.'],
      secret: ['Secret Routes', 'Look for glowing side entrances near stations. Hidden tunnels, rooftops, and bridge paths contain bonus diamonds and shortcut rewards.']
    }[key];
    if (!content) return;
    detail.innerHTML = `<h3>${content[0]}</h3><p>${content[1]}</p>`;
    detail.classList.remove('hidden');
    detail.querySelectorAll('[data-upgrade]').forEach(button => button.onclick = () => { if(api.upgrade(button.dataset.upgrade)) openFeature('upgrade'); else notify('Collect more coins to upgrade'); });
    detail.querySelectorAll('[data-outfit]').forEach(button => button.onclick = () => { const name=button.dataset.outfit; const cost=Number(button.dataset.cost); if(!data.outfits.includes(name) && !api.unlockOutfit(name,cost)) return notify('Collect more coins to unlock'); api.selectOutfit(name); openFeature('outfit'); });
    detail.querySelector('[data-claim-weekly]')?.addEventListener('click', () => { if(api.claimWeekly()) { notify('WEEKLY CHALLENGE COMPLETE  +3 STARS'); openFeature('weekly'); } else notify('Run 3,000 meters this week first'); });
    if (key === 'tutorial') {
      const lessons=['Swipe left or right to change lanes.','Swipe up to jump over barriers.','Swipe down to slide under overhead signs.','Collect boosts and crystals on the track.','During parachute flight, steer toward floating diamonds.'];
      let step=0;
      detail.innerHTML=`<h3>HOW TO PLAY</h3><p id="tutorial-copy">${lessons[step]}</p><button class="detail-action" id="tutorial-next">Next tip · 1 / ${lessons.length}</button>`;
      detail.querySelector('#tutorial-next').onclick=event=>{step=(step+1)%lessons.length;detail.querySelector('#tutorial-copy').textContent=lessons[step];event.currentTarget.textContent=`Next tip · ${step+1} / ${lessons.length}`;};
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    const detail = document.createElement('section'); detail.id='feature-detail'; detail.className='feature-detail hidden';
    document.querySelector('.feature-menu-card')?.append(detail);
    document.querySelectorAll('.feature-tile').forEach(tile => tile.addEventListener('click', () => {
      const key = [...tile.classList].find(name => name !== 'feature-tile');
      openFeature(key);
    }));
    updateMissionCard();
    updateJourney();
    document.getElementById('btn-daily-reward')?.addEventListener('click', () => notify('Daily reward claimed'));
    window.addEventListener('urban-dash-toast', event => { const node=document.getElementById('hud-toast-msg'); if(node){node.textContent=event.detail;node.classList.remove('hidden');setTimeout(()=>node.classList.add('hidden'),2100);} });
    const burst = label => { const node=document.createElement('div'); node.className='journey-celebration'; node.innerHTML=`<span>✦ ✧ ✹ ✧ ✦</span><strong>${label}</strong><span>✹ ✧ ✦ ✧ ✹</span>`; document.body.append(node); setTimeout(()=>node.remove(),2600); };
    window.addEventListener('urban-dash-destination',()=>burst('GRAND CENTRAL!'));
    window.addEventListener('urban-dash-photo',()=>burst('SECRET STAR MOMENT'));
  });
})();
