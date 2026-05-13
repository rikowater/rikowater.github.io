const boardLayer = document.querySelector("#boardLayer");
const gameScreen = document.querySelector("#gameScreen");
const resetButton = document.querySelector("#resetButton");
const hintButton = document.querySelector("#hintButton");
const menuButton = document.querySelector(".menu-button");
const pausePanel = document.querySelector("#pausePanel");
const resumeButton = document.querySelector("#resumeButton");
const pcBird = document.querySelector("#pcBird");
const birdSprite = document.querySelector("#birdSprite");
const goalMarker = document.querySelector("#goalMarker");
const resultPanel = document.querySelector("#resultPanel");
const resultResetButton = document.querySelector("#resultResetButton");
const stageToast = document.querySelector("#stageToast");

const stageMap = [
  "   ######    ",
  "  ##....###  ",
  " ##..##..G#  ",
  " #...#..###  ",
  " #B..#....#  ",
  " ###..##..#  ",
  "   #.....##  ",
  "   ######    "
];

const featureByCell = {
  B: "start",
  G: "goal"
};

const assetPaths = {
  cloud: "./assets/tiles/cloud-wall-generated.png",
  startPad: "./assets/gimmicks/start-pad.png",
  goalPad: "./assets/gimmicks/goal-pad.png"
};

const birdSprites = {
  idle: "./assets/sprites/bird-directions/bird-idle.png",
  up: "./assets/sprites/bird-directions/bird-up.png",
  down: "./assets/sprites/bird-directions/bird-down.png",
  left: "./assets/sprites/bird-directions/bird-left.png",
  right: "./assets/sprites/bird-directions/bird-right.png"
};

const keyToVector = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  D: { x: 1, y: 0 }
};

const directionLabels = {
  up: "上",
  down: "下",
  left: "左",
  right: "右"
};

const rowCount = stageMap.length;
const colCount = Math.max(...stageMap.map((row) => row.length));
const boardFrame = {
  left: 10.4,
  top: 4.4,
  width: 79.2,
  height: 91.2
};

const makeElement = (className, tag = "div") => {
  const element = document.createElement(tag);
  element.className = className;
  return element;
};

const boardPosition = (col, row) => ({
  x: boardFrame.left + ((col + 0.5) / colCount) * boardFrame.width,
  y: boardFrame.top + ((row + 0.5) / rowCount) * boardFrame.height
});

const addBoardItem = (className, col, row, innerHTML = "") => {
  const item = makeElement(`iso-item ${className}`);
  const pos = boardPosition(col, row);
  item.style.setProperty("--iso-x", `${pos.x}%`);
  item.style.setProperty("--iso-y", `${pos.y}%`);
  item.style.zIndex = String(100 + row * 12 + col);
  item.innerHTML = innerHTML;
  boardLayer.appendChild(item);
  return item;
};

const assetMarkup = (src) => `<img class="asset-img" src="${src}" alt="" />`;

const findCell = (target) => {
  for (let row = 0; row < rowCount; row += 1) {
    const col = stageMap[row].indexOf(target);
    if (col !== -1) return { col, row };
  }
  return { col: 0, row: 0 };
};

const cellAt = (col, row) => stageMap[row]?.[col] || " ";

const cellForPosition = (col, row) => ({
  col: Math.floor(col + 0.5),
  row: Math.floor(row + 0.5)
});

const isWalkableCell = (col, row) => {
  const cell = cellAt(col, row);
  return cell !== " " && cell !== "#";
};

const playerRadius = 0.26;
const canOccupy = (col, row) => {
  const samples = [
    [0, 0],
    [playerRadius, 0],
    [-playerRadius, 0],
    [0, playerRadius],
    [0, -playerRadius],
    [playerRadius * 0.72, playerRadius * 0.72],
    [-playerRadius * 0.72, playerRadius * 0.72],
    [playerRadius * 0.72, -playerRadius * 0.72],
    [-playerRadius * 0.72, -playerRadius * 0.72]
  ];

  return samples.every(([offsetCol, offsetRow]) => {
    const cell = cellForPosition(col + offsetCol, row + offsetRow);
    return isWalkableCell(cell.col, cell.row);
  });
};

const startCell = findCell("B");
const goalCell = findCell("G");
let playerPosition = { col: startCell.col, row: startCell.row };
let stepCount = 0;
let toastTimer;
let controlStatus = "待機";
let tiltX = 0;
let tiltY = 0;
let deviceGyroActive = false;
let gyroEnableInProgress = false;
let deviceBaseline = null;
let lastFrameAt = 0;
let lastBlockedAt = 0;
let activeDirection = "idle";
let stageCleared = false;
const pressedKeys = new Set();
const keyHoldTimers = new Map();
const inputDeadzone = 0.08;
const maxCellsPerSecond = 3.25;
const gyroTiltDegrees = 24;

stageMap.forEach((rowString, row) => {
  [...rowString].forEach((cell, col) => {
    if (cell === " ") return;

    if (cell !== "#") {
      const type =
        featureByCell[cell] === "start"
          ? "start"
          : featureByCell[cell] === "goal"
            ? "goal"
            : "path";
      addBoardItem(`floor-tile ${type}`, col, row);
    }

    if (cell === "#") {
      addBoardItem(`cloud-wall ${(col + row) % 4 === 0 ? "soft" : ""} has-image`, col, row, assetMarkup(assetPaths.cloud));
    }

    if (cell === "B") {
      addBoardItem("start-pad has-image", col, row, assetMarkup(assetPaths.startPad));
    }

    if (cell === "G") {
      addBoardItem("goal-pad has-image", col, row, assetMarkup(assetPaths.goalPad));
    }
  });
});

const showToast = (message) => {
  if (!stageToast) return;
  window.clearTimeout(toastTimer);
  stageToast.textContent = message;
  stageToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    stageToast.classList.remove("is-visible");
  }, 900);
};

const focusGameInput = () => {
  if (!gameScreen) return;
  gameScreen.setAttribute("tabindex", "0");
  gameScreen.focus({ preventScroll: true });
};

const setControlStatus = (message) => {
  controlStatus = message;
  if (gameScreen) gameScreen.dataset.controlStatus = message;
};

const placeMarker = (element, position, xName, yName) => {
  if (!element) return;
  const pos = boardPosition(position.col, position.row);
  element.style.setProperty(xName, `${pos.x}%`);
  element.style.setProperty(yName, `${pos.y}%`);
};

const updatePlayer = () => {
  placeMarker(pcBird, playerPosition, "--player-x", "--player-y");
  placeMarker(goalMarker, goalCell, "--goal-x", "--goal-y");
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampTilt = (value) => clamp(value, -1, 1);

const setBirdDirection = (direction) => {
  const nextDirection = birdSprites[direction] ? direction : "idle";
  if (nextDirection === activeDirection) return;
  activeDirection = nextDirection;
  if (pcBird) pcBird.dataset.direction = nextDirection;
  if (birdSprite) birdSprite.src = birdSprites[nextDirection];
};

const setTilt = (nextX, nextY, source = "実機") => {
  tiltX = clampTilt(nextX);
  tiltY = clampTilt(nextY);
  gameScreen.style.setProperty("--scene-offset-x", `${(-tiltX * 4.5).toFixed(2)}px`);
  gameScreen.style.setProperty("--scene-offset-y", `${(-tiltY * 3.5).toFixed(2)}px`);
  if (pcBird) pcBird.style.setProperty("--lean", tiltX.toFixed(3));
  const directionName = dominantDirection({ x: tiltX, y: tiltY });
  if (directionName) setBirdDirection(directionName);
  setControlStatus(directionName ? `${source}: ${directionLabels[directionName]}` : "待機");
};

const dominantDirection = ({ x, y }) => {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (Math.max(absX, absY) < inputDeadzone) return null;
  if (absX >= absY) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
};

const popClass = (element, className, duration = 260) => {
  if (!element) return;
  element.classList.remove(className);
  window.requestAnimationFrame(() => {
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  });
};

const showResult = () => {
  stageCleared = true;
  resultPanel?.classList.add("is-open");
  resultPanel?.setAttribute("aria-hidden", "false");
};

const currentKeyboardVector = () => {
  const vector = { x: 0, y: 0 };
  pressedKeys.forEach((key) => {
    const keyVector = keyToVector[key];
    if (!keyVector) return;
    vector.x += keyVector.x;
    vector.y += keyVector.y;
  });
  return normalizeVector(vector);
};

const normalizeVector = ({ x, y }) => {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= inputDeadzone) return { x: 0, y: 0, strength: 0 };
  const cappedMagnitude = Math.min(1, magnitude);
  return {
    x: x / magnitude,
    y: y / magnitude,
    strength: cappedMagnitude
  };
};

const currentMoveVector = () => {
  const keyboardVector = currentKeyboardVector();
  if (keyboardVector.strength > 0) return keyboardVector;
  return normalizeVector({ x: tiltX, y: tiltY });
};

const showBlockedFeedback = () => {
  const now = Date.now();
  if (now - lastBlockedAt < 260) return;
  lastBlockedAt = now;
  popClass(pcBird, "is-blocked", 220);
};

const tryMovePlayer = (deltaCol, deltaRow) => {
  let moved = false;
  const nextCol = playerPosition.col + deltaCol;
  if (canOccupy(nextCol, playerPosition.row)) {
    playerPosition.col = nextCol;
    moved = true;
  }

  const nextRow = playerPosition.row + deltaRow;
  if (canOccupy(playerPosition.col, nextRow)) {
    playerPosition.row = nextRow;
    moved = true;
  }

  if (!moved && (Math.abs(deltaCol) > 0 || Math.abs(deltaRow) > 0)) {
    showBlockedFeedback();
  }

  return moved;
};

const pulseKeyboardMove = (key) => {
  if (stageCleared) return;
  const keyVector = keyToVector[key];
  if (!keyVector) return;
  setBirdDirection(dominantDirection(keyVector));
  const moved = tryMovePlayer(keyVector.x * 0.12, keyVector.y * 0.12);
  if (!moved) return;
  updatePlayer();
  updateGoalState();
};

const updateGoalState = () => {
  const distanceToGoal = Math.hypot(playerPosition.col - goalCell.col, playerPosition.row - goalCell.row);
  if (distanceToGoal < 0.52) {
    if (!pcBird?.classList.contains("is-goal")) {
      pcBird?.classList.add("is-goal");
      setControlStatus("到着");
      showResult();
    }
  } else {
    pcBird?.classList.remove("is-goal");
  }
};

const animatePlayer = (timestamp) => {
  if (!lastFrameAt) lastFrameAt = timestamp;
  const deltaSeconds = Math.min(0.04, (timestamp - lastFrameAt) / 1000);
  lastFrameAt = timestamp;

  const moveVector = currentMoveVector();
  if (!stageCleared && moveVector.strength > 0) {
    setBirdDirection(dominantDirection(moveVector));
    const speed = maxCellsPerSecond * moveVector.strength;
    const moved = tryMovePlayer(moveVector.x * speed * deltaSeconds, moveVector.y * speed * deltaSeconds);
    if (moved) {
      stepCount += deltaSeconds;
      pcBird?.classList.add("is-moving");
      window.clearTimeout(animatePlayer.moveTimer);
      animatePlayer.moveTimer = window.setTimeout(() => pcBird?.classList.remove("is-moving"), 120);
      setControlStatus(dominantDirection(moveVector) || "移動中");
    }
  }

  updatePlayer();
  updateGoalState();
  window.requestAnimationFrame(animatePlayer);
};

const resetStage = () => {
  clearTilt();
  stageCleared = false;
  resultPanel?.classList.remove("is-open");
  resultPanel?.setAttribute("aria-hidden", "true");
  pressedKeys.clear();
  keyHoldTimers.forEach((timer) => window.clearTimeout(timer));
  keyHoldTimers.clear();
  playerPosition = { col: startCell.col, row: startCell.row };
  stepCount = 0;
  updatePlayer();
  pcBird?.classList.remove("is-goal", "is-blocked", "is-moving");
  setBirdDirection("idle");
  popClass(pcBird, "reset-pop", 620);
  setControlStatus("待機");
};

window.addEventListener("keydown", (event) => {
  if (!keyToVector[event.key]) return;
  event.preventDefault();
  pressedKeys.add(event.key);
  pulseKeyboardMove(event.key);
  window.clearTimeout(keyHoldTimers.get(event.key));
  keyHoldTimers.set(
    event.key,
    window.setTimeout(() => {
      pressedKeys.delete(event.key);
      keyHoldTimers.delete(event.key);
    }, 180)
  );
});

window.addEventListener("keyup", (event) => {
  if (!keyToVector[event.key]) return;
  event.preventDefault();
  window.clearTimeout(keyHoldTimers.get(event.key));
  keyHoldTimers.set(
    event.key,
    window.setTimeout(() => {
      pressedKeys.delete(event.key);
      keyHoldTimers.delete(event.key);
    }, 90)
  );
});

const stopDeviceGyro = () => {
  if (!deviceGyroActive) return;
  window.removeEventListener("deviceorientation", handleDeviceOrientation);
  deviceGyroActive = false;
  gyroEnableInProgress = false;
};

const clearTilt = () => {
  setTilt(0, 0, "実機");
  deviceBaseline = null;
};

const screenAngle = () => {
  const angle = Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);
  return ((angle % 360) + 360) % 360;
};

const tiltForScreen = (betaDelta, gammaDelta) => {
  const angle = screenAngle();
  if (angle >= 45 && angle < 135) return { x: betaDelta, y: -gammaDelta };
  if (angle >= 135 && angle < 225) return { x: -gammaDelta, y: -betaDelta };
  if (angle >= 225 && angle < 315) return { x: -betaDelta, y: gammaDelta };
  return { x: gammaDelta, y: betaDelta };
};

function handleDeviceOrientation(event) {
  if (event.beta === null || event.gamma === null) return;

  const beta = Number(event.beta);
  const gamma = Number(event.gamma);
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

  const angle = screenAngle();
  if (!deviceBaseline || deviceBaseline.angle !== angle) {
    deviceBaseline = { beta, gamma, angle };
    setTilt(0, 0, "実機");
    return;
  }

  const screenTilt = tiltForScreen(beta - deviceBaseline.beta, gamma - deviceBaseline.gamma);
  setTilt(screenTilt.x / gyroTiltDegrees, screenTilt.y / gyroTiltDegrees, "実機");
}

const enableDeviceGyro = async () => {
  if (deviceGyroActive || gyroEnableInProgress) return;

  if (typeof window.DeviceOrientationEvent === "undefined") {
    setControlStatus("キーボード");
    return;
  }

  gyroEnableInProgress = true;
  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        setControlStatus("未許可");
        return;
      }
    }

    deviceBaseline = null;
    window.addEventListener("deviceorientation", handleDeviceOrientation);
    deviceGyroActive = true;
    setControlStatus("実機待ち");
  } catch (error) {
    setControlStatus("未許可");
  } finally {
    gyroEnableInProgress = false;
  }
};

const handleGyroStartGesture = () => {
  focusGameInput();
  void enableDeviceGyro();
};

const bindGyroStart = () => {
  if (typeof window.DeviceOrientationEvent === "undefined") {
    setControlStatus("キーボード");
    return;
  }

  if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
    window.addEventListener("pointerdown", handleGyroStartGesture, { once: true });
    window.addEventListener("touchend", handleGyroStartGesture, { once: true });
    return;
  }

  void enableDeviceGyro();
};

const resetGyroBaseline = () => {
  if (!deviceGyroActive) return;
  clearTilt();
};

resetButton?.addEventListener("click", resetStage);
resultResetButton?.addEventListener("click", resetStage);
hintButton?.addEventListener("click", () => {
  gameScreen.classList.add("hinting");
  window.setTimeout(() => gameScreen.classList.remove("hinting"), 1600);
});
menuButton?.addEventListener("click", () => {
  pausePanel.classList.add("is-open");
  pausePanel.setAttribute("aria-hidden", "false");
});
resumeButton?.addEventListener("click", () => {
  pausePanel.classList.remove("is-open");
  pausePanel.setAttribute("aria-hidden", "true");
});
pausePanel?.addEventListener("click", (event) => {
  if (event.target === pausePanel) resumeButton.click();
});
window.addEventListener("orientationchange", resetGyroBaseline);
window.screen?.orientation?.addEventListener?.("change", resetGyroBaseline);
window.addEventListener("pointerdown", focusGameInput);

updatePlayer();
setTilt(0, 0);
focusGameInput();
bindGyroStart();
window.requestAnimationFrame(animatePlayer);
