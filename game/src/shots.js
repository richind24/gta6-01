// Cobalt Vice — ?shot= scene presets for screenshots (cover/mission/city/harbor).
function applyShot(name) {
  G.time = 12.0; // bright noon for every shot
  G.weather = 0;
  const placeCar = (x, z, a) => {
    const mesh = makeCarMesh(0xe44e61, false);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const car = { mesh, x, z, a, v: 18, road: 0, axis: 'x', dir: 1, speed: 0, player: true };
    G.world.traffic.push(car);
    G.vehicle = car;
    G.mode = 'car';
    G.player.mesh.visible = false;
    G.player.x = x;
    G.player.z = z;
    G.player.a = a;
    return car;
  };
  if (name === 'cover') {
    // Daylight police pursuit down a downtown avenue: player speeding, cop cars
    // ahead cutting across and one chasing from behind, beacon down the road.
    placeCar(300, -230, -Math.PI / 2);
    G.vehicle.v = 25;
    G.keys['w'] = true;
    G.wanted = 4;
    G.mission = { index: 0, title: 'POLICE PURSUIT', obj: 'Lose the Meridian precinct units', type: 'goto', marker: [300, -600], t: 0 };
    makeBeacon(300, -600, 0xffd23c);
    const copSpots = [[292, -310, -Math.PI / 2], [308, -360, Math.PI / 2], [340, -160, -Math.PI / 2]];
    for (let i = 0; i < copSpots.length; i++) {
      const [cx, cz, ca] = copSpots[i];
      const mesh = makeCarMesh(0x11151a, true);
      mesh.position.set(cx, 0, cz);
      G.scene.add(mesh);
      G.world.cops.push({ mesh, x: cx, z: cz, a: ca, v: 40, health: 100, lightT: i });
    }
    G.money = 18450;
    toast('POLICE PURSUIT — lose them');
  } else if (name === 'mission') {
    // Story mission 2 in progress, player on foot near the helipad, facing it.
    G.player.x = -620;
    G.player.z = 620;
    G.player.a = Math.PI * 0.75;
    G.player.mesh.position.set(-620, 0, 620);
    G.wanted = 2;
    G.money = 12300;
    startMission(1);
  } else if (name === 'city') {
    // Free roam on foot on the plaza, facing the Meridian Exchange tower.
    G.player.x = 0;
    G.player.z = 60;
    G.player.a = -Math.PI / 2;
    G.player.mesh.position.set(0, 0, 60);
    G.wanted = 1;
    G.money = 8450;
    toast('FREE ROAM — explore Port Meridian');
  } else if (name === 'harbor') {
    // Boat run at the marina.
    const mesh = makeBoatMesh(0xf2bd51);
    mesh.position.set(780, 0, -300);
    G.scene.add(mesh);
    const boat = { mesh, x: 780, z: -300, a: Math.PI / 2, v: 12, player: true, moored: false };
    G.world.boats.push(boat);
    G.vehicle = boat;
    G.mode = 'boat';
    G.player.mesh.visible = false;
    G.player.x = 780;
    G.player.z = -300;
    G.player.a = Math.PI / 2;
    G.wanted = 2;
    G.money = 15200;
    G.mission = { index: 3, title: 'TIDE TURNER', obj: 'Deliver the package to the marina', type: 'goto', marker: [850, -300], t: 0 };
    makeBeacon(850, -300, 0xffd23c);
  }
  G.camA = G.player.a;
}
