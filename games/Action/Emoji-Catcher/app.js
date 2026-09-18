// ==================== DOM元素 ====================
const squares = document.querySelectorAll(".square");
const scoreEl = document.getElementById("score");
const timeLeftEl = document.getElementById("time-left");
const highScoreEl = document.getElementById("high-score");

const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");

const difficultyBtns = document.querySelectorAll(".difficulty-btn");
// Dedicated to my girlfriend

const gameOverModal = document.getElementById("game-over-modal");
const finalScoreEl = document.getElementById("final-score");
const modalMessageEl = document.getElementById("modal-message");
const playAgainBtn = document.getElementById("play-again-btn");

// ==================== 游戏状态 ====================
let score = 0;
let timeLeft = 60;
let currentSquare = null;
let gameActive = false;
let gamePaused = false;
let moveTimerId = null;
let countdownTimerId = null;

// 难度设置
const difficulties = {
  easy: { speed: 1000, time: 60, name: "简单" },
  normal: { speed: 600, time: 60, name: "普通" },
  hard: { speed: 350, time: 45, name: "困难" }
};
let currentDifficulty = "normal";

// Emoji列表
const emojis = ["😊", "😎", "🥳", "😍", "🤩", "😂", "🤣", "😋", "🥰"];

// 统计数据 - 按难度分别存储
let stats = {
  easy: { highScore: 0 },
  normal: { highScore: 0 },
  hard: { highScore: 0 }
};

// ==================== 初始化 ====================
/**
 * 初始化游戏
 */
function init() {
  loadStats();
  updateStatsDisplay();
  setupEventListeners();
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 方块点击事件
  squares.forEach(square => {
    square.addEventListener("click", handleSquareClick);
  });

  // 控制按钮
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", playAgain);

  // 难度选择
  difficultyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!gameActive) {
        setDifficulty(btn.dataset.difficulty);
      }

/* Created by SinceraXY */
    });
  });
}

// ==================== 难度系统 ====================
/**
 * 设置难度
 */
function setDifficulty(difficulty) {
  currentDifficulty = difficulty;
  timeLeft = difficulties[difficulty].time;
  timeLeftEl.textContent = timeLeft;
  
  // 更新按钮状态
  difficultyBtns.forEach(btn => {
    if (btn.dataset.difficulty === difficulty) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

  });
  
  // 更新当前难度的最高分显示
  updateStatsDisplay();
}

// ==================== 游戏控制 ====================
/**
 * 开始游戏
 */
function startGame() {
  if (gameActive) return;
  
  gameActive = true;
  gamePaused = false;
  score = 0;
  timeLeft = difficulties[currentDifficulty].time;
  
  updateDisplay();
  
  // 切换按钮显示
  startBtn.classList.add("hide");
  pauseBtn.classList.remove("hide");
  resetBtn.classList.remove("hide");
  
  // 启动游戏
  moveEmoji();
  startCountdown();
}

/**
 * 暂停/继续游戏
 */
function togglePause() {
  if (!gameActive) return;
  
  gamePaused = !gamePaused;
  
  if (gamePaused) {
    // 暂停
    clearInterval(moveTimerId);
    clearInterval(countdownTimerId);
    pauseBtn.querySelector(".btn-text").textContent = "继续";
    pauseBtn.querySelector(".btn-icon").textContent = "▶️";
  } else {
    // 继续
    moveEmoji();
    startCountdown();
    pauseBtn.querySelector(".btn-text").textContent = "暂停";
    pauseBtn.querySelector(".btn-icon").textContent = "⏸️";
  }
}

/**
 * 重置游戏
 */
function resetGame() {
  stopGame();
  score = 0;
  timeLeft = difficulties[currentDifficulty].time;
  updateDisplay();
  removeAllEmojis();
  
  // 重置按钮
  startBtn.classList.remove("hide");
  pauseBtn.classList.add("hide");
  resetBtn.classList.add("hide");
  pauseBtn.querySelector(".btn-text").textContent = "暂停";
  pauseBtn.querySelector(".btn-icon").textContent = "⏸️";
}

/**
 * 停止游戏
 */
function stopGame() {
  gameActive = false;
  gamePaused = false;
  clearInterval(moveTimerId);
  clearInterval(countdownTimerId);
}

/**
 * 游戏结束
 */
function endGame() {
  stopGame();
  
  // 更新当前难度的最高分
  if (score > stats[currentDifficulty].highScore) {
    stats[currentDifficulty].highScore = score;
    saveStats();
    updateStatsDisplay();
  }
  
  // 显示结果弹窗
  showGameOverModal();
  
  // 重置按钮
  startBtn.classList.remove("hide");
  pauseBtn.classList.add("hide");
  resetBtn.classList.add("hide");
  pauseBtn.querySelector(".btn-text").textContent = "暂停";
  pauseBtn.querySelector(".btn-icon").textContent = "⏸️";
  
  removeAllEmojis();
}

/**
 * 再玩一次
 */
function playAgain() {
  hideGameOverModal();
  resetGame();
  startGame();
}

// ==================== Emoji逻辑 ====================
/**
 * 移动Emoji
 */
function moveEmoji() {
  const speed = difficulties[currentDifficulty].speed;
  moveTimerId = setInterval(showRandomEmoji, speed);
}

/**
 * 显示随机Emoji
 */
function showRandomEmoji() {
  if (!gameActive || gamePaused) return;
  
  // 移除上一个Emoji
  removeAllEmojis();
  
  // 随机选择一个方块
  const randomIndex = Math.floor(Math.random() * squares.length);
  const square = squares[randomIndex];
  
  // 随机选择一个Emoji
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  square.classList.add("emoji");
  square.textContent = randomEmoji;
  currentSquare = square;
}

/**
 * 移除所有Emoji
 */
function removeAllEmojis() {
  squares.forEach(square => {
    square.classList.remove("emoji");
    square.textContent = "";
  });
  currentSquare = null;
}

/**
 * 处理方块点击
 */
function handleSquareClick(event) {
  if (!gameActive || gamePaused) return;
  
  const square = event.currentTarget;
  
  if (square === currentSquare && square.classList.contains("emoji")) {
    // 击中！
    score++;
    updateDisplay();
    
    // 添加击中动画
    square.classList.add("hit");
    setTimeout(() => {
      square.classList.remove("hit");
    }, 400);


    
    // 移除当前emoji，标记为已点击
    const wasClicked = true;
    removeAllEmojis();
    
    // 重置定时器，但不立即显示新emoji
    clearInterval(moveTimerId);
    const speed = difficulties[currentDifficulty].speed;
    moveTimerId = setInterval(showRandomEmoji, speed);
  }
}

// ==================== 倒计时 ====================
/**
 * 开始倒计时
 */
function startCountdown() {
  countdownTimerId = setInterval(() => {
    if (gameActive && !gamePaused) {
      timeLeft--;
      updateDisplay();
      
      if (timeLeft <= 0) {
        endGame();
      }
    }

// SinceraXY @ China University of Petroleum, Beijing
  }, 1000);
}

// ==================== UI更新 ====================
/**
 * 更新显示
 */
function updateDisplay() {
  scoreEl.textContent = score;
  timeLeftEl.textContent = timeLeft;
}

/**
 * 更新统计显示
 */
function updateStatsDisplay() {
  // 显示当前难度的最高分
  highScoreEl.textContent = stats[currentDifficulty].highScore;
}

// ==================== 弹窗控制 ====================
/**
 * 显示游戏结束弹窗
 */
function showGameOverModal() {
  finalScoreEl.textContent = score;
  
  // 根据分数给出评价
  let message = "";
  if (score >= 50) {
    message = "🏆 完美！你的反应速度惊人！";
  } else if (score >= 30) {
    message = "🌟 非常优秀！手速很快！";
  } else if (score >= 20) {
    message = "👍 不错！继续努力！";
  } else if (score >= 10) {
    message = "💪 还可以，多练习会更好！";
  } else {
    message = "😊 加油！再试一次！";
/* Developer: SinceraXY - CUPB */
  }
  
  modalMessageEl.textContent = message;
  gameOverModal.classList.remove("hide");
}

/**
 * 隐藏游戏结束弹窗
 */
function hideGameOverModal() {
  gameOverModal.classList.add("hide");
}

// ==================== 本地存储 ====================
/**
 * 加载统计数据
 */
function loadStats() {
  try {
    const saved = localStorage.getItem("emojiCatcherStats");
    if (saved) {
      const data = JSON.parse(saved);
      // 兼容旧版本数据
      if (data.highScore !== undefined) {
        stats.normal.highScore = data.highScore;
      } else {
        stats.easy.highScore = data.easy?.highScore || 0;
        stats.normal.highScore = data.normal?.highScore || 0;
        stats.hard.highScore = data.hard?.highScore || 0;
      }
    }
  } catch (error) {
    console.error("加载统计数据失败:", error);
  }
}

/**
 * 保存统计数据
 */
function saveStats() {
  try {
    localStorage.setItem("emojiCatcherStats", JSON.stringify(stats));
  } catch (error) {
    console.error("保存统计数据失败:", error);
  }

/* SinceraXY @ China University of Petroleum, Beijing */
}

// ==================== 启动 ====================
init();
