// Input: keyboard state, mouse orbit (drag), click-to-shoot, wheel zoom.

export function createInput(G) {
  const input = {
    up: false, down: false, left: false, right: false, shift: false,
    mouseDX: 0, mouseDY: 0, shooting: false, dragging: false,
    pressed: {}, // edge-triggered keys, consumed by the game loop
  };
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'shift', ShiftRight: 'shift',
  };
  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
    if (!e.repeat) input.pressed[e.code] = true;
    if (['Space', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyM', 'Escape', 'Enter'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
  });
  const canvas = document.getElementById('game');
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.shooting = true; input.dragging = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { input.shooting = false; input.dragging = false; }
  });
  window.addEventListener('mousemove', (e) => {
    if (input.dragging) {
      input.mouseDX += e.movementX || 0;
      input.mouseDY += e.movementY || 0;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    G.player.camDist = Math.max(4.5, Math.min(13, G.player.camDist + Math.sign(e.deltaY) * 0.8));
    e.preventDefault();
  }, { passive: false });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.shift = false;
    input.shooting = false; input.dragging = false;
  });
  return input;
}
