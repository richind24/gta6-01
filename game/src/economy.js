// Cobalt Vice — economy: weapon shop, properties, garage upgrades, save/load.
function spawnShops() {
  const defs = [
    { kind: 'weapons', label: 'IRONWORKS ARMS', x: 150, z: -300, color: 0xff5a3c },
    { kind: 'bar', label: 'NEON BAR — $15,000', x: -300, z: -150, color: 0xff4ad8, price: 15000, income: 500 },
    { kind: 'garage', label: 'HARBOR GARAGE — $25,000', x: 450, z: 150, color: 0x35d05a, price: 25000, income: 900 },
  ];
  for (const d of defs) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 0.6),
      new THREE.MeshLambertMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.7 })
    );
    // Put the sign on the nearest building face (just above street level, floating as a shop front).
    sign.position.set(d.x, 5, d.z);
    G.scene.add(sign);
    G.world.shops.push({ ...d, mesh: sign });
  }
}

function nearestShop(maxD) {
  let best = null;
  let bd = maxD;
  for (const s of G.world.shops) {
    const d = dist2(s.x, s.z, G.player.x, G.player.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

function openShop() {
  const el = document.getElementById('shop');
  const list = document.getElementById('shop-list');
  if (!el || !list) return;
  G.shopOpen = true;
  let html = '<h2>IRONWORKS ARMS</h2><p>Cash: $' + G.money.toLocaleString() + '</p>';
  for (const key of ['pistol', 'smg', 'shotgun', 'rifle']) {
    const w = WEAPONS[key];
    const owned = G.weapons[key];
    html += '<div class="shop-row"><span>' + w.name + ' — $' + w.price.toLocaleString() +
      (owned ? ' (owned)' : '') + '</span>' +
      '<button data-buy="' + key + '">' + (owned ? 'AMMO $' + w.ammoPrice : 'BUY $' + w.price.toLocaleString()) + '</button></div>';
  }
  html += '<div class="shop-row"><span>Armor plating (less damage) — $2,000</span><button data-buy="armor">BUY</button></div>';
  html += '<div class="shop-row"><span>Engine tune (faster cars) — $3,000</span><button data-buy="engine">BUY</button></div>';
  html += '<p class="hint">Press E or Esc to close. Keys 1–5 switch weapons.</p>';
  list.innerHTML = html;
  el.style.display = 'block';
  list.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => buyItem(b.getAttribute('data-buy')));
  });
}

function closeShop() {
  const el = document.getElementById('shop');
  if (el) el.style.display = 'none';
  G.shopOpen = false;
}

function buyItem(key) {
  if (key === 'armor') {
    if (G.upgrades.armor > 0) { toast('Armor already installed'); return; }
    if (G.money < 2000) { toast('Not enough cash'); AudioSys.denied(); return; }
    G.money -= 2000;
    G.upgrades.armor = 1;
    AudioSys.cash();
    toast('Armor plating installed — you take 40% less damage');
  } else if (key === 'engine') {
    if (G.upgrades.engine > 0) { toast('Engine already tuned'); return; }
    if (G.money < 3000) { toast('Not enough cash'); AudioSys.denied(); return; }
    G.money -= 3000;
    G.upgrades.engine = 1;
    AudioSys.cash();
    toast('Engine tuned — top speed up 18%');
  } else {
    const w = WEAPONS[key];
    if (G.weapons[key]) {
      if (G.money < w.ammoPrice) { toast('Not enough cash for ammo'); AudioSys.denied(); return; }
      G.money -= w.ammoPrice;
      G.ammo[key] += key === 'smg' ? 120 : key === 'rifle' ? 30 : key === 'shotgun' ? 16 : 24;
      AudioSys.cash();
      toast(w.name + ' ammo restocked');
    } else {
      if (G.money < w.price) { toast('Not enough cash'); AudioSys.denied(); return; }
      G.money -= w.price;
      G.weapons[key] = true;
      G.ammo[key] = key === 'smg' ? 120 : key === 'rifle' ? 30 : key === 'shotgun' ? 16 : 24;
      G.weapon = key;
      AudioSys.cash();
      toast(w.name + ' purchased — press ' + ({ pistol: '2', smg: '3', shotgun: '4', rifle: '5' })[key] + ' to equip');
    }
  }
  saveGame();
  if (G.shopOpen) openShop();
}

function tryBuyProperty(shop) {
  if (shop.kind === 'bar' || shop.kind === 'garage') {
    const key = shop.kind;
    if (G.props[key]) {
      toast((key === 'bar' ? 'Neon Bar' : 'Harbor Garage') + ' already yours — it pays $' + shop.income + '/min');
      return;
    }
    if (G.money < shop.price) {
      toast('You need $' + shop.price.toLocaleString() + ' for the ' + (key === 'bar' ? 'Neon Bar' : 'Harbor Garage'));
      AudioSys.denied();
      return;
    }
    G.money -= shop.price;
    G.props[key] = true;
    AudioSys.cash();
    toast((key === 'bar' ? 'Neon Bar' : 'Harbor Garage') + ' bought — passive income $' + shop.income + '/min');
    saveGame();
  }
}

function updateEconomy(dt) {
  const income = (G.props.bar ? 500 : 0) + (G.props.garage ? 900 : 0);
  if (income > 0) {
    G.incomeT += dt;
    if (G.incomeT >= 60) {
      G.incomeT = 0;
      G.money += income;
      toast('Property income +$' + income.toLocaleString());
      AudioSys.cash();
    }
  }
}

function saveGame() {
  try {
    localStorage.setItem('cobaltvice-save-v1', JSON.stringify({
      money: G.money,
      missionIndex: G.missionIndex,
      weapons: G.weapons,
      ammo: G.ammo,
      props: G.props,
      upgrades: G.upgrades,
      x: G.player.x,
      z: G.player.z,
      time: G.time,
    }));
  } catch (e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem('cobaltvice-save-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
