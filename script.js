const boardLayer = document.querySelector("#boardLayer");
const gameScreen = document.querySelector("#gameScreen");
const resetButton = document.querySelector("#resetButton");
const menuButton = document.querySelector("#menuButton");
const stageMenu = document.querySelector("#stageMenu");
const nextStageButton = document.querySelector("#nextStageButton");
const retryStageButton = document.querySelector("#retryStageButton");
const pcBird = document.querySelector("#pcBird");
const birdSprite = document.querySelector("#birdSprite");
const goalMarker = document.querySelector("#goalMarker");
const resultPanel = document.querySelector("#resultPanel");
const resultResetButton = document.querySelector("#resultResetButton");
const stageToast = document.querySelector("#stageToast");
const distanceHud = document.querySelector("#distanceHud");
const distanceBarFill = document.querySelector("#distanceBarFill");
const stageLabel = document.querySelector("#stageLabel");
const movementTrailPath = document.querySelector("#movementTrailPath");
const movementTrailGlow = document.querySelector("#movementTrailGlow");
const portraitLockedLandscapeQuery = window.matchMedia?.("(orientation: portrait) and (max-width: 900px)");

const rowCount = 8;
const colCount = 13;
const playableBounds = {
  minCol: 1,
  maxCol: colCount - 2,
  minRow: 1,
  maxRow: rowCount - 2
};

const featureByCell = {
  B: "start",
  G: "goal"
};

const assetPaths = {
  cloud: "./assets/tiles/cloud-wall-generated.png",
  startPad: "./assets/gimmicks/start-pad.png",
  goalPad: "./assets/gimmicks/goal-pad.png",
  experienceStone: "./assets/gimmicks/experience-stone.png"
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

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);
const manhattanDistance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

const inPlayableBounds = (col, row) =>
  col >= playableBounds.minCol &&
  col <= playableBounds.maxCol &&
  row >= playableBounds.minRow &&
  row <= playableBounds.maxRow;

const createStageGrid = () => {
  const grid = Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => " "));
  for (let row = playableBounds.minRow; row <= playableBounds.maxRow; row += 1) {
    for (let col = playableBounds.minCol; col <= playableBounds.maxCol; col += 1) {
      grid[row][col] = ".";
    }
  }
  return grid;
};

const shuffleDirections = () =>
  [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ].sort(() => Math.random() - 0.5);

const isGridWalkable = (grid, col, row) => {
  const cell = grid[row]?.[col] || " ";
  return cell !== " " && cell !== "#";
};

const canReachGoal = (grid, start, goal) => {
  const queue = [start];
  const visited = new Set([`${start.col}:${start.row}`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.col === goal.col && current.row === goal.row) return true;

    shuffleDirections().forEach((direction) => {
      const next = { col: current.col + direction.x, row: current.row + direction.y };
      const key = `${next.col}:${next.row}`;
      if (visited.has(key) || !isGridWalkable(grid, next.col, next.row)) return;
      visited.add(key);
      queue.push(next);
    });
  }

  return false;
};

const cloudNeighborCount = (grid, col, row) =>
  shuffleDirections().filter((direction) => grid[row + direction.y]?.[col + direction.x] === "#").length;

const generateStageMap = () => {
  const grid = createStageGrid();
  const start = {
    col: randomInt(playableBounds.minCol, playableBounds.minCol + 1),
    row: randomInt(playableBounds.minRow + 1, playableBounds.maxRow - 1)
  };
  const goal = {
    col: randomInt(playableBounds.maxCol - 1, playableBounds.maxCol),
    row: randomInt(playableBounds.minRow, playableBounds.maxRow)
  };
  const cloudTarget = randomInt(7, 12);
  const cloudCandidates = [];

  for (let row = playableBounds.minRow; row <= playableBounds.maxRow; row += 1) {
    for (let col = playableBounds.minCol; col <= playableBounds.maxCol; col += 1) {
      const position = { col, row };
      if (manhattanDistance(position, start) <= 1 || manhattanDistance(position, goal) <= 1) continue;
      cloudCandidates.push(position);
    }
  }

  let cloudsPlaced = 0;
  shuffle(cloudCandidates).forEach(({ col, row }) => {
    if (cloudsPlaced >= cloudTarget) return;
    if (cloudNeighborCount(grid, col, row) > 0 && Math.random() < 0.78) return;

    grid[row][col] = "#";
    if (canReachGoal(grid, start, goal)) {
      cloudsPlaced += 1;
      return;
    }
    grid[row][col] = ".";
  });

  if (cloudsPlaced < cloudTarget) {
    shuffle(cloudCandidates).forEach(({ col, row }) => {
      if (cloudsPlaced >= cloudTarget || grid[row][col] === "#") return;
      if (cloudNeighborCount(grid, col, row) > 1) return;
      grid[row][col] = "#";
      if (canReachGoal(grid, start, goal)) {
        cloudsPlaced += 1;
        return;
      }
      grid[row][col] = ".";
    });
  }

  grid[start.row][start.col] = "B";
  grid[goal.row][goal.col] = "G";
  return grid.map((row) => row.join(""));
};

let stageMap = generateStageMap();

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

let startCell = findCell("B");
let goalCell = findCell("G");
let playerPosition = { col: startCell.col, row: startCell.row };
let collectibles = [];
let maxTravelDistance = 1;
let travelDistance = 0;
let stageBuildId = 0;
let stageNumber = 99;
let trailPoints = [];
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
let lastMoveSoundAt = 0;
let activeDirection = "idle";
let stageCleared = false;
let audioContext;
const pressedKeys = new Set();
const keyHoldTimers = new Map();
const inputDeadzone = 0.08;
const maxCellsPerSecond = 3.25;
const gyroTiltDegrees = 24;

const walkableStageCells = () => {
  const cells = [];
  stageMap.forEach((rowString, row) => {
    [...rowString].forEach((cell, col) => {
      if (cell !== "#" && cell !== " ") cells.push({ col, row, cell });
    });
  });
  return cells;
};

const shortestPathDistance = () => {
  const queue = [{ ...startCell, distance: 0 }];
  const visited = new Set([`${startCell.col}:${startCell.row}`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.col === goalCell.col && current.row === goalCell.row) return current.distance;

    shuffleDirections().forEach((direction) => {
      const next = { col: current.col + direction.x, row: current.row + direction.y };
      const key = `${next.col}:${next.row}`;
      if (visited.has(key) || !isWalkableCell(next.col, next.row)) return;
      visited.add(key);
      queue.push({ ...next, distance: current.distance + 1 });
    });
  }

  return 12;
};

const createCollectibles = () => {
  const candidates = walkableStageCells().filter(({ col, row, cell }) => {
    const position = { col, row };
    return cell === "." && manhattanDistance(position, startCell) > 2 && manhattanDistance(position, goalCell) > 1;
  });
  const fallbackCandidates = walkableStageCells().filter(({ cell }) => cell === ".");
  const source = candidates.length > 0 ? candidates : fallbackCandidates;
  const count = Math.min(randomInt(1, 3), source.length);
  stageBuildId += 1;
  return shuffle(source)
    .slice(0, count)
    .map((cell, index) => ({
      id: `stone-${stageBuildId}-${index}`,
      col: cell.col,
      row: cell.row,
      collected: false
    }));
};

const updateDistanceHud = () => {
  const remaining = Math.max(0, maxTravelDistance - travelDistance);
  const ratio = clamp(remaining / maxTravelDistance, 0, 1);
  distanceBarFill?.style.setProperty("--distance-ratio", ratio.toFixed(3));
  distanceHud?.classList.toggle("is-low", ratio <= 0.25 && ratio > 0);
  distanceHud?.classList.toggle("is-empty", ratio <= 0);
  distanceHud?.setAttribute("aria-label", `移動可能距離 残り${Math.ceil(remaining)}`);
};

const resetTravelDistance = () => {
  const routeDistance = shortestPathDistance();
  maxTravelDistance = Math.ceil(Math.max(12, routeDistance * 1.35 + collectibles.length * 0.8 + 2));
  travelDistance = 0;
  updateDistanceHud();
};

const updateStageLabel = () => {
  if (stageLabel) stageLabel.textContent = `ステージ ${stageNumber}（仮）`;
};

const trailPointFor = (position) => {
  const pos = boardPosition(position.col, position.row);
  return { x: pos.x, y: pos.y };
};

const updateMovementTrail = () => {
  const pathData =
    trailPoints.length < 2
      ? ""
      : trailPoints
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ");
  movementTrailPath?.setAttribute("d", pathData);
  movementTrailGlow?.setAttribute("d", pathData);
};

const addTrailPoint = (position, force = false) => {
  const nextPoint = trailPointFor(position);
  const previousPoint = trailPoints.at(-1);

  if (!previousPoint) {
    trailPoints.push(nextPoint);
  } else {
    const distance = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
    if (force || distance > 0.7) {
      trailPoints.push(nextPoint);
    } else {
      trailPoints[trailPoints.length - 1] = nextPoint;
    }
  }

  if (trailPoints.length > 72) trailPoints = trailPoints.slice(-72);
  updateMovementTrail();
};

const resetTrail = () => {
  trailPoints = [trailPointFor(playerPosition)];
  updateMovementTrail();
};

const resumeAudio = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
};

const playTone = (frequency, delay = 0, duration = 0.14, gainValue = 0.035, type = "sine") => {
  const context = resumeAudio();
  if (!context) return;
  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
};

const playSound = (name) => {
  if (name === "move") {
    const now = performance.now();
    if (now - lastMoveSoundAt < 170) return;
    lastMoveSoundAt = now;
    playTone(520, 0, 0.08, 0.012, "sine");
    return;
  }

  if (name === "collect") {
    playTone(740, 0, 0.13, 0.034, "sine");
    playTone(1060, 0.055, 0.18, 0.026, "triangle");
    return;
  }

  if (name === "blocked") {
    playTone(190, 0, 0.1, 0.026, "triangle");
    return;
  }

  if (name === "goal") {
    playTone(620, 0, 0.16, 0.032, "sine");
    playTone(880, 0.09, 0.18, 0.028, "sine");
    playTone(1240, 0.18, 0.24, 0.02, "triangle");
    return;
  }

  if (name === "menu") {
    playTone(560, 0, 0.08, 0.018, "sine");
    return;
  }

  if (name === "reset") {
    playTone(430, 0, 0.11, 0.02, "triangle");
  }
};

const renderStage = () => {
  boardLayer.replaceChildren();
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

  collectibles.forEach((item) => {
    if (item.collected) return;
    const stone = addBoardItem("experience-stone has-image", item.col, item.row, assetMarkup(assetPaths.experienceStone));
    stone.dataset.collectibleId = item.id;
  });
};

const applyStageState = () => {
  startCell = findCell("B");
  goalCell = findCell("G");
  playerPosition = { col: startCell.col, row: startCell.row };
  collectibles = createCollectibles();
  resetTravelDistance();
  resetTrail();
  updateStageLabel();
  renderStage();
};

const rebuildStage = () => {
  stageMap = generateStageMap();
  applyStageState();
};

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
  playSound("blocked");
  popClass(pcBird, "is-blocked", 220);
};

const collectExperienceStones = () => {
  collectibles.forEach((item) => {
    if (item.collected) return;
    const distance = Math.hypot(playerPosition.col - item.col, playerPosition.row - item.row);
    if (distance > 0.45) return;

    item.collected = true;
    playSound("collect");
    const stoneElement = boardLayer.querySelector(`[data-collectible-id="${item.id}"]`);
    stoneElement?.classList.add("is-collected");
    window.setTimeout(() => stoneElement?.remove(), 260);
  });
};

const showDistanceLimitFeedback = () => {
  setControlStatus("距離切れ");
  distanceHud?.classList.add("is-empty");
  showBlockedFeedback();
};

const tryMovePlayer = (deltaCol, deltaRow) => {
  const requestedDistance = Math.hypot(deltaCol, deltaRow);
  const remainingDistance = maxTravelDistance - travelDistance;
  if (requestedDistance > 0 && remainingDistance <= 0) {
    showDistanceLimitFeedback();
    return false;
  }

  if (requestedDistance > remainingDistance) {
    const limitScale = Math.max(0, remainingDistance / requestedDistance);
    deltaCol *= limitScale;
    deltaRow *= limitScale;
  }

  let moved = false;
  const beforePosition = { ...playerPosition };
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

  if (moved) {
    const actualDistance = Math.hypot(playerPosition.col - beforePosition.col, playerPosition.row - beforePosition.row);
    travelDistance = Math.min(maxTravelDistance, travelDistance + actualDistance);
    addTrailPoint(playerPosition);
    collectExperienceStones();
    updateDistanceHud();
    playSound("move");
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
      playSound("goal");
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

const closeStageMenu = () => {
  stageMenu?.classList.remove("is-open");
  stageMenu?.setAttribute("aria-hidden", "true");
  menuButton?.setAttribute("aria-expanded", "false");
};

const toggleStageMenu = () => {
  const isOpen = stageMenu?.classList.contains("is-open");
  if (isOpen) {
    closeStageMenu();
    return;
  }

  stageMenu?.classList.add("is-open");
  stageMenu?.setAttribute("aria-hidden", "false");
  menuButton?.setAttribute("aria-expanded", "true");
  playSound("menu");
};

const resetStage = ({ next = false } = {}) => {
  clearTilt();
  stageCleared = false;
  resultPanel?.classList.remove("is-open");
  resultPanel?.setAttribute("aria-hidden", "true");
  pressedKeys.clear();
  keyHoldTimers.forEach((timer) => window.clearTimeout(timer));
  keyHoldTimers.clear();
  if (next) {
    stageNumber += 1;
    rebuildStage();
  } else {
    applyStageState();
  }
  stepCount = 0;
  updatePlayer();
  pcBird?.classList.remove("is-goal", "is-blocked", "is-moving");
  setBirdDirection("idle");
  popClass(pcBird, "reset-pop", 620);
  setControlStatus("待機");
  closeStageMenu();
  playSound("reset");
};

window.addEventListener("keydown", (event) => {
  if (!keyToVector[event.key]) return;
  event.preventDefault();
  resumeAudio();
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
  const lockedLandscapeOffset = portraitLockedLandscapeQuery?.matches ? 90 : 0;
  return (((angle + lockedLandscapeOffset) % 360) + 360) % 360;
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
menuButton?.addEventListener("click", () => {
  focusGameInput();
  toggleStageMenu();
});
nextStageButton?.addEventListener("click", () => resetStage({ next: true }));
retryStageButton?.addEventListener("click", () => resetStage());
window.addEventListener("pointerdown", (event) => {
  resumeAudio();
  if (!event.target?.closest?.(".top-menu")) closeStageMenu();
});
window.addEventListener("orientationchange", resetGyroBaseline);
window.screen?.orientation?.addEventListener?.("change", resetGyroBaseline);
portraitLockedLandscapeQuery?.addEventListener?.("change", resetGyroBaseline);
window.addEventListener("pointerdown", focusGameInput);

applyStageState();
updatePlayer();
setTilt(0, 0);
focusGameInput();
bindGyroStart();
window.requestAnimationFrame(animatePlayer);
