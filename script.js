const boardLayer = document.querySelector("#boardLayer");
const gameScreen = document.querySelector("#gameScreen");
const resetButton = document.querySelector("#resetButton");
const hintButton = document.querySelector("#hintButton");
const menuButton = document.querySelector(".menu-button");
const pausePanel = document.querySelector("#pausePanel");
const resumeButton = document.querySelector("#resumeButton");
const pcBird = document.querySelector("#pcBird");
const goalMarker = document.querySelector("#goalMarker");
const tiltDot = document.querySelector("#tiltDot");
const gyroStatus = document.querySelector("#gyroStatus");
const tiltXSlider = document.querySelector("#tiltXSlider");
const tiltYSlider = document.querySelector("#tiltYSlider");
const tiltXValue = document.querySelector("#tiltXValue");
const tiltYValue = document.querySelector("#tiltYValue");
const deviceGyroButton = document.querySelector("#deviceGyroButton");
const gyroCenterButton = document.querySelector("#gyroCenterButton");
const stageToast = document.querySelector("#stageToast");

const stageMap = [
  "   ######    ",
  "  ##..C.###  ",
  " ##..##..G#  ",
  " #..V#..###  ",
  " #B..#S..C#  ",
  " ###..##..#  ",
  "   #..V..##  ",
  "   ######    "
];

const featureByCell = {
  B: "start",
  C: "crystal",
  V: "vortex",
  S: "sun",
  G: "goal"
};

const assetPaths = {
  floor: "./assets/tiles/floor.svg",
  start: "./assets/tiles/floor-start.svg",
  goalFloor: "./assets/tiles/floor-goal.svg",
  cloud: "./assets/tiles/cloud-wall.svg",
  crystal: "./assets/gimmicks/crystal.svg",
  vortex: "./assets/gimmicks/vortex.svg",
  sun: "./assets/gimmicks/sun-pad.svg",
  goalFeather: "./assets/gimmicks/goal-feather.svg",
  spark: "./assets/gimmicks/spark.svg"
};

const directions = {
  up: { col: 0, row: -1, label: "上" },
  down: { col: 0, row: 1, label: "下" },
  left: { col: -1, row: 0, label: "左" },
  right: { col: 1, row: 0, label: "右" }
};

const keyToDirection = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right"
};

const makeElement = (className, tag = "div") => {
  const element = document.createElement(tag);
  element.className = className;
  return element;
};

const isoPosition = (col, row) => ({
  x: 45.6 + (col - row) * 3.72,
  y: 9.2 + (col + row) * 4.55
});

const addIsoItem = (className, col, row, innerHTML = "") => {
  const item = makeElement(`iso-item ${className}`);
  const pos = isoPosition(col, row);
  item.style.setProperty("--iso-x", `${pos.x}%`);
  item.style.setProperty("--iso-y", `${pos.y}%`);
  item.style.zIndex = String(100 + (col + row) * 4);
  item.innerHTML = innerHTML;
  boardLayer.appendChild(item);
  return item;
};

const assetMarkup = (src) => `<img class="asset-img" src="${src}" alt="" />`;

const findCell = (target) => {
  for (let row = 0; row < stageMap.length; row += 1) {
    const col = stageMap[row].indexOf(target);
    if (col !== -1) return { col, row };
  }
  return { col: 0, row: 0 };
};

const cellAt = (col, row) => stageMap[row]?.[col] || " ";
const isWalkable = (col, row) => {
  const cell = cellAt(col, row);
  return cell !== " " && cell !== "#";
};

const startCell = findCell("B");
const goalCell = findCell("G");
let playerCell = { ...startCell };
let stepCount = 0;
let toastTimer;
let tiltX = 0;
let tiltY = 0;
let deviceGyroActive = false;
let deviceBaseline = null;
let lastGyroMoveAt = 0;
const gyroMoveThreshold = 0.36;
const gyroMoveInterval = 430;

stageMap.forEach((rowString, row) => {
  [...rowString].forEach((cell, col) => {
    if (cell === " ") return;

    if (cell !== "#") {
      const type =
        featureByCell[cell] === "start"
          ? "start"
          : featureByCell[cell] === "goal"
            ? "goal"
            : featureByCell[cell] === "sun"
              ? "pad"
              : "path";
      const src = type === "start" ? assetPaths.start : type === "goal" ? assetPaths.goalFloor : assetPaths.floor;
      addIsoItem(`floor-tile ${type} has-image`, col, row, assetMarkup(src));
    }

    if (cell === "#") {
      addIsoItem(`cloud-wall ${(col + row) % 4 === 0 ? "soft" : ""} has-image`, col, row, assetMarkup(assetPaths.cloud));
    }

    if (cell === "C") {
      addIsoItem("crystal has-image", col, row, assetMarkup(assetPaths.crystal));
      addIsoItem("spark has-image", col + 0.36, row - 0.12, assetMarkup(assetPaths.spark));
    }

    if (cell === "V") {
      addIsoItem("vortex has-image", col, row, assetMarkup(assetPaths.vortex));
    }

    if (cell === "S") {
      addIsoItem("sun-stone has-image", col, row, assetMarkup(assetPaths.sun));
      addIsoItem("spark has-image", col - 0.32, row + 0.05, assetMarkup(assetPaths.spark));
    }

    if (cell === "G") {
      addIsoItem("goal-feather has-image", col, row, assetMarkup(assetPaths.goalFeather));
      addIsoItem("spark has-image", col + 0.28, row - 0.24, assetMarkup(assetPaths.spark));
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
  }, 1600);
};

const setGyroStatus = (message) => {
  if (gyroStatus) gyroStatus.value = message;
};

const placeMarker = (element, cell, xName, yName) => {
  if (!element) return;
  const pos = isoPosition(cell.col, cell.row);
  element.style.setProperty(xName, `${pos.x}%`);
  element.style.setProperty(yName, `${pos.y}%`);
};

const updatePlayer = () => {
  placeMarker(pcBird, playerCell, "--player-x", "--player-y");
  placeMarker(goalMarker, goalCell, "--goal-x", "--goal-y");
};

const clampTilt = (value) => Math.max(-1, Math.min(1, value));

const syncTiltUi = () => {
  if (tiltXSlider) tiltXSlider.value = String(Math.round(tiltX * 100));
  if (tiltYSlider) tiltYSlider.value = String(Math.round(tiltY * 100));
  if (tiltXValue) tiltXValue.value = tiltX.toFixed(2);
  if (tiltYValue) tiltYValue.value = tiltY.toFixed(2);
};

const directionFromTilt = () => {
  const absX = Math.abs(tiltX);
  const absY = Math.abs(tiltY);
  if (Math.max(absX, absY) < gyroMoveThreshold) return null;
  if (absX >= absY) return tiltX > 0 ? "right" : "left";
  return tiltY > 0 ? "down" : "up";
};

const setTilt = (nextX, nextY, source = "スライダー", updateSliders = true) => {
  tiltX = clampTilt(nextX);
  tiltY = clampTilt(nextY);
  gameScreen.style.setProperty("--tilt-x", tiltX.toFixed(3));
  gameScreen.style.setProperty("--tilt-y", tiltY.toFixed(3));
  gameScreen.style.setProperty("--scene-offset-x", `${(-tiltX * 5).toFixed(2)}px`);
  gameScreen.style.setProperty("--scene-offset-y", `${(-tiltY * 4).toFixed(2)}px`);
  if (pcBird) pcBird.style.setProperty("--lean", tiltX.toFixed(3));
  if (tiltDot) {
    tiltDot.style.transform = `translate(calc(-50% + ${tiltX * 1.18}rem), calc(-50% + ${tiltY * 1.18}rem))`;
  }
  if (updateSliders) syncTiltUi();
  const directionName = directionFromTilt();
  setGyroStatus(directionName ? `${source}: ${directions[directionName].label}` : "待機");
};

const popClass = (element, className, duration = 260) => {
  if (!element) return;
  element.classList.remove(className);
  window.requestAnimationFrame(() => {
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  });
};

const movePlayer = (directionName) => {
  const direction = directions[directionName];
  if (!direction) return;

  const nextCell = {
    col: playerCell.col + direction.col,
    row: playerCell.row + direction.row
  };

  if (!isWalkable(nextCell.col, nextCell.row)) {
    popClass(pcBird, "is-blocked", 280);
    setGyroStatus("進めない");
    showToast("雲の壁にぶつかった");
    return;
  }

  playerCell = nextCell;
  stepCount += 1;
  updatePlayer();
  popClass(pcBird, "is-moving", 260);
  setGyroStatus(`${stepCount}手目`);

  if (cellAt(playerCell.col, playerCell.row) === "G") {
    pcBird?.classList.add("is-goal");
    setGyroStatus("到着");
    showToast("光の道がつながった");
  } else {
    pcBird?.classList.remove("is-goal");
  }
};

const resetStage = () => {
  stopDeviceGyro();
  clearTilt();
  playerCell = { ...startCell };
  stepCount = 0;
  updatePlayer();
  pcBird?.classList.remove("is-goal", "is-blocked", "is-moving");
  popClass(pcBird, "reset-pop", 620);
  setGyroStatus("待機");
  showToast("出発点に戻った");
};

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    movePlayer(button.dataset.move);
    button.blur();
  });
});

window.addEventListener("keydown", (event) => {
  const directionName = keyToDirection[event.key];
  if (!directionName) return;
  event.preventDefault();
  movePlayer(directionName);
});

const stopDeviceGyro = () => {
  if (!deviceGyroActive) return;
  window.removeEventListener("deviceorientation", handleDeviceOrientation);
  deviceGyroActive = false;
};

const clearTilt = () => {
  setTilt(0, 0, "中央");
  deviceBaseline = null;
};

function handleDeviceOrientation(event) {
  const beta = Number(event.beta || 0);
  const gamma = Number(event.gamma || 0);
  if (!deviceBaseline) {
    deviceBaseline = { beta, gamma };
  }
  setTilt((gamma - deviceBaseline.gamma) / 28, (beta - deviceBaseline.beta) / 28, "実機", true);
}

const enableDeviceGyro = async () => {
  if (typeof window.DeviceOrientationEvent === "undefined") {
    setGyroStatus("未対応");
    return;
  }

  if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
    const permission = await window.DeviceOrientationEvent.requestPermission();
    if (permission !== "granted") {
      setGyroStatus("未許可");
      return;
    }
  }

  deviceBaseline = null;
  if (!deviceGyroActive) {
    window.addEventListener("deviceorientation", handleDeviceOrientation);
    deviceGyroActive = true;
  }
  setGyroStatus("実機待ち");
};

const updateTiltFromSliders = () => {
  stopDeviceGyro();
  const nextX = Number(tiltXSlider?.value || 0) / 100;
  const nextY = Number(tiltYSlider?.value || 0) / 100;
  setTilt(nextX, nextY, "スライダー", false);
  syncTiltUi();
};

const tickGyroMovement = () => {
  const directionName = directionFromTilt();
  if (!directionName) return;
  const now = Date.now();
  if (now - lastGyroMoveAt < gyroMoveInterval) return;
  lastGyroMoveAt = now;
  movePlayer(directionName);
};

tiltXSlider?.addEventListener("input", updateTiltFromSliders);
tiltYSlider?.addEventListener("input", updateTiltFromSliders);
deviceGyroButton?.addEventListener("click", enableDeviceGyro);
gyroCenterButton?.addEventListener("click", () => {
  stopDeviceGyro();
  clearTilt();
});

window.setInterval(tickGyroMovement, 80);

resetButton.addEventListener("click", resetStage);

const showHint = () => {
  gameScreen.classList.add("hinting");
  setGyroStatus("光へ");
  showToast("青い羽根を目指そう");
  window.setTimeout(() => gameScreen.classList.remove("hinting"), 2400);
};

hintButton.addEventListener("click", showHint);

menuButton.addEventListener("click", () => {
  pausePanel.classList.add("is-open");
  pausePanel.setAttribute("aria-hidden", "false");
});

resumeButton.addEventListener("click", () => {
  pausePanel.classList.remove("is-open");
  pausePanel.setAttribute("aria-hidden", "true");
});

pausePanel.addEventListener("click", (event) => {
  if (event.target === pausePanel) resumeButton.click();
});

setTilt(0, 0);
updatePlayer();
