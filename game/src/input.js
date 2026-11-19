// Solara Bay — keyboard and mouse input, kept apart from the game logic.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,       // set true on a fresh click, consumed by the game loop
    anyKey: false,
  };

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyR', 'KeyF',
    'KeyM', 'KeyP', 'Escape', 'Space', 'ShiftLeft', 'ShiftRight', 'Enter',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Digit1', 'Digit2', 'Digit3',
  ]);

  function onKeyDown(e) {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.anyKey = true;
    input.keys.add(e.code);
  }
  function onKeyUp(e) {
    input.keys.delete(e.code);
  }
  function onMouseMove(e) {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) input.mouseDown = false;
  }
  function onBlur() {
    input.keys.clear();
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  input.down = (code) => input.keys.has(code);
  input.axis = () => {
    let x = 0, y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  input.consumeClick = () => {
    const c = input.clicked;
    input.clicked = false;
    return c;
  };
  input.detach = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('blur', onBlur);
  };
  return input;
}
