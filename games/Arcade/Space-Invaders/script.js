// ==================== 游戏配置 ====================
const CONFIG = {
  canvasWidth: 720,
  canvasHeight: 600,
  player: {
    width: 40,
    height: 40,
    speed: 5,
    color: '#00d4ff'
  },
  alien: {
    width: 35,
    height: 35,
    rows: 4,
    cols: 8,
    spacing: 15,
    speed: 1,
    dropDistance: 20
  },
  bullet: {
    width: 4,
    height: 15,
    speed: 7,
    color: '#00ff88'
  },
  alienBullet: {
    width: 4,
    height: 15,
    speed: 4,
    color: '#ff3366'
  }
};

// ==================== 游戏状态 ====================
let canvas, ctx;
let gameActive = false;
let gamePaused = false;
let score = 0;
let lives = 3;
let level = 1;
let highScore = 0;
let soundEnabled = true;

// 游戏对象
let player = null;
let aliens = [];
let bullets = [];
let alienBullets = [];
let alienDirection = 1; // 1 = 右, -1 = 左
let alienSpeed = CONFIG.alien.speed;
let alienShootTimer = 0;
let levelTransition = false; // 关卡过渡状态
let displayDirty = false; // 显示需要更新的标记
let lastLives = 3; // 上次的生命值，用于优化hearts更新

// 全局音频上下文（避免重复创建导致内存泄漏）
let audioContext = null;
let audioInitialized = false;

function getAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext creation failed:', e);
      return null;
    }

// Made by SinceraXY
  }
  
  // 确保AudioContext处于运行状态
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(err => {
      console.warn('AudioContext resume failed:', err);
    });
  }
  
  return audioContext;
}

// 在用户交互时初始化音频（异步，不阻塞游戏）
function initAudio() {
  if (!audioInitialized && soundEnabled) {
    audioInitialized = true;
    // 使用setTimeout确保不阻塞游戏启动
    setTimeout(() => {
      getAudioContext();
    }, 0);
  }
}

// 预生成星星数据（避免每帧调用Math.random()）
const stars = [];
for (let i = 0; i < 50; i++) {
  stars.push({
    x: (i * 137.5) % 720,
    y: (i * 234.7) % 600,
    size: Math.random() * 1.5 + 0.5
  });
}

// 键盘状态
let keys = {
  left: false,
  right: false,
  space: false
};

// ==================== DOM 元素 ====================
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const levelDisplay = document.getElementById('level');
const highScoreDisplay = document.getElementById('highScore');
const heartsContainer = document.getElementById('heartsContainer');
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const soundBtn = document.getElementById('soundBtn');
const resumeBtn = document.getElementById('resumeBtn');
const quitBtn = document.getElementById('quitBtn');
const gameOverModal = document.getElementById('gameOverModal');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  loadHighScore();
  attachEventListeners();
  updateDisplay();
});

function initCanvas() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;
  
  // 绘制初始画面
  drawBackground();
}

function attachEventListeners() {
  // 开始按钮
  startBtn.addEventListener('click', startGame);
  
  // 暂停按钮
  pauseBtn.addEventListener('click', togglePause);
  
  // 重新开始按钮
  restartBtn.addEventListener('click', restartGame);
  
  // 音效按钮
  soundBtn.addEventListener('click', toggleSound);
  
  // 暂停界面按钮
  if (resumeBtn) {
    resumeBtn.addEventListener('click', togglePause);
  }
  if (quitBtn) {
    quitBtn.addEventListener('click', quitToMenu);
  }
  
  // 游戏结束按钮
  playAgainBtn.addEventListener('click', () => {
    closeModal(gameOverModal);
    restartGame();
  });
  
  if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
      closeModal(gameOverModal);
      quitToMenu();
    });
  }
  
  // 键盘事件
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

// ==================== 游戏控制 ====================
function startGame() {
  startOverlay.classList.add('hidden');
  gameActive = true;
  gamePaused = false;
  
  // 在用户交互时初始化音频（避免阻塞）
  initAudio();
  
  initGameObjects();
  gameLoop();
}

function togglePause() {
  if (!gameActive) return;
  
  gamePaused = !gamePaused;
  
  if (gamePaused) {
    pauseOverlay.classList.remove('hidden');
    pauseBtn.querySelector('.btn-text').textContent = '继续';
    pauseBtn.querySelector('.btn-icon').textContent = '▶️';
  } else {
    pauseOverlay.classList.add('hidden');
    pauseBtn.querySelector('.btn-text').textContent = '暂停';
    pauseBtn.querySelector('.btn-icon').textContent = '⏸️';
  }
}

function restartGame() {
  gameActive = false;
  gamePaused = false;
  levelTransition = false;
  displayDirty = false;
  score = 0;
  lives = 3;
  lastLives = -1; // 强制更新hearts
  level = 1;
  alienSpeed = CONFIG.alien.speed;
  
  updateDisplay();
  startOverlay.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  pauseBtn.querySelector('.btn-text').textContent = '暂停';
  pauseBtn.querySelector('.btn-icon').textContent = '⏸️';
  
  drawBackground();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundBtn.classList.toggle('muted');
  soundBtn.querySelector('.btn-icon').textContent = soundEnabled ? '🔊' : '🔇';
}

function endGame() {
  gameActive = false;
  
  // 更新最高分
  const isNewHighScore = score > highScore;
  if (isNewHighScore) {
    highScore = score;
    saveHighScore();
  }
  
  // 更新游戏结束显示
  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalLevel').textContent = level;
  
  // 显示新纪录
  const newHighScoreCard = document.getElementById('newHighScoreCard');
  if (isNewHighScore && newHighScoreCard) {
    newHighScoreCard.style.display = 'flex';
    document.getElementById('finalHighScore').textContent = highScore;
  } else if (newHighScoreCard) {
    newHighScoreCard.style.display = 'none';
  }
  
  setTimeout(() => {
    gameOverModal.classList.add('active');
  }, 500);
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// ==================== 游戏对象初始化 ====================
function initGameObjects() {
  // 初始化玩家
  player = {
    x: CONFIG.canvasWidth / 2 - CONFIG.player.width / 2,
    y: CONFIG.canvasHeight - CONFIG.player.height - 20,
    width: CONFIG.player.width,
    height: CONFIG.player.height,
    speed: CONFIG.player.speed
  };
  
  // 初始化外星人
  createAliens();
  
  // 清空子弹
  bullets = [];
  alienBullets = [];
  
  // 重置方向和速度
  alienDirection = 1;
  alienSpeed = CONFIG.alien.speed + (level - 1) * 0.3;
  alienShootTimer = 0;
}

function createAliens() {
  aliens = [];
  const startX = 50;
  const startY = 60;
  
  for (let row = 0; row < CONFIG.alien.rows; row++) {
    for (let col = 0; col < CONFIG.alien.cols; col++) {
      aliens.push({
        x: startX + col * (CONFIG.alien.width + CONFIG.alien.spacing),
        y: startY + row * (CONFIG.alien.height + CONFIG.alien.spacing),
        width: CONFIG.alien.width,
        height: CONFIG.alien.height,
        type: row // 不同行不同类型
      });
    }
  }
}

// ==================== 键盘控制 ====================
function handleKeyDown(e) {
  if (e.key === 'ArrowLeft') {
    keys.left = true;
  } else if (e.key === 'ArrowRight') {
    keys.right = true;
  } else if (e.key === ' ') {
    e.preventDefault();
    if (gameActive && !gamePaused) {
      keys.space = true;
      shootBullet();
    }
  } else if (e.key === 'p' || e.key === 'P') {
    togglePause();
  }
}

function handleKeyUp(e) {
  if (e.key === 'ArrowLeft') {
    keys.left = false;
  } else if (e.key === 'ArrowRight') {
    keys.right = false;
  } else if (e.key === ' ') {
    keys.space = false;
  }
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (!gameActive) return;
  
  if (!gamePaused) {
    update();
    draw();
  }
  
  requestAnimationFrame(gameLoop);
}

// ==================== 更新逻辑 ====================
function update() {
  // 关卡过渡期间，只更新子弹和玩家位置
  if (levelTransition) {
    updatePlayer();
    updateBullets();
    updateAlienBullets();
    return;
  }
  
  // 更新玩家
  updatePlayer();
  
  // 更新外星人
  updateAliens();
  
  // 更新子弹
  updateBullets();
  
  // 更新外星人子弹
  updateAlienBullets();

// Made with love

  
  // 外星人射击
  alienShoot();
  
  // 碰撞检测
  checkCollisions();
  
  // 检查关卡完成
  checkLevelComplete();
  
  // 在主循环中统一更新显示（减少DOM操作）
  if (displayDirty) {
    updateDisplay();
    displayDirty = false;
  }
}

function updatePlayer() {
  if (keys.left && player.x > 0) {
    player.x -= player.speed;
  }
  if (keys.right && player.x < CONFIG.canvasWidth - player.width) {
    player.x += player.speed;
  }
}

function updateAliens() {
  let shouldDrop = false;
  
  // 检查是否需要改变方向
  for (let alien of aliens) {
    if ((alienDirection === 1 && alien.x + alien.width >= CONFIG.canvasWidth - 10) ||
        (alienDirection === -1 && alien.x <= 10)) {
      shouldDrop = true;
      break;
    }
  }
  
  if (shouldDrop) {
    alienDirection *= -1;
    for (let alien of aliens) {
      alien.y += CONFIG.alien.dropDistance;
    }
  }
  
  // 移动外星人
  for (let alien of aliens) {
    alien.x += alienDirection * alienSpeed;
    
    // 检查外星人是否到达底部
    if (alien.y + alien.height >= player.y) {
      lives = 0;
      displayDirty = true;
      endGame();
      return;
    }
  }
}

function updateBullets() {
  bullets = bullets.filter(bullet => {
    bullet.y -= bullet.speed;
    return bullet.y > 0;
  });
}

function updateAlienBullets() {
  alienBullets = alienBullets.filter(bullet => {
    bullet.y += bullet.speed;
    return bullet.y < CONFIG.canvasHeight;
  });
}

function shootBullet() {
  bullets.push({
    x: player.x + player.width / 2 - CONFIG.bullet.width / 2,
    y: player.y,
    width: CONFIG.bullet.width,
    height: CONFIG.bullet.height,
    speed: CONFIG.bullet.speed
  });
  
  playSound('shoot');
}

function alienShoot() {
  alienShootTimer++;
  
  // 每隔一定帧数，随机一个外星人射击
  if (alienShootTimer > 60 - level * 5 && aliens.length > 0) {
    alienShootTimer = 0;
    
    // 随机选择一个外星人
    const randomAlien = aliens[Math.floor(Math.random() * aliens.length)];
    
    alienBullets.push({
      x: randomAlien.x + randomAlien.width / 2 - CONFIG.alienBullet.width / 2,
      y: randomAlien.y + randomAlien.height,
      width: CONFIG.alienBullet.width,
      height: CONFIG.alienBullet.height,
      speed: CONFIG.alienBullet.speed
    });
  }
}

// ==================== 碰撞检测 ====================
function checkCollisions() {
  let scoreChanged = false;
  let livesChanged = false;
  
  // 子弹击中外星人
/* Author: SinceraXY */
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    
    for (let j = aliens.length - 1; j >= 0; j--) {
      const alien = aliens[j];
      
      if (isColliding(bullet, alien)) {
        // 移除子弹和外星人
        bullets.splice(i, 1);
        aliens.splice(j, 1);
        
        // 增加分数
        score += (alien.type + 1) * 10;
        scoreChanged = true;
        
        playSound('explosion');
        break;
      }
    }
  }
  
  // 外星人子弹击中玩家
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    const bullet = alienBullets[i];
    
    if (isColliding(bullet, player)) {
      alienBullets.splice(i, 1);
      lives--;
      livesChanged = true;
      
      playSound('hit');
      
      if (lives <= 0) {
        displayDirty = true;
        endGame();
      }
      break;
    }
  }
  
  // 标记显示需要更新
  if (scoreChanged || livesChanged) {
    displayDirty = true;
  }
}

function isColliding(obj1, obj2) {
  return obj1.x < obj2.x + obj2.width &&
         obj1.x + obj1.width > obj2.x &&
         obj1.y < obj2.y + obj2.height &&
         obj1.y + obj1.height > obj2.y;
}

function checkLevelComplete() {
  if (aliens.length === 0 && !levelTransition) {
    levelTransition = true;
    level++;
    displayDirty = true;
    updateDisplay(); // 关卡切换时立即更新
    playSound('levelUp');
    
    // 短暂延迟后开始新关卡
    setTimeout(() => {
      if (gameActive) {
        initGameObjects();
        levelTransition = false;
      }

// GameHub Project - https://github.com/SinceraXY/GameHub
    }, 2000);
  }
}

// ==================== 绘制 ====================
function draw() {
  drawBackground();
  drawPlayer();
  drawAliens();
  drawBullets();
  drawAlienBullets();
  
  // 关卡过渡提示
  if (levelTransition) {
    drawLevelTransition();
  }
}

function drawBackground() {
  // 黑色背景
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  
  // 星星效果（使用预生成数据）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let star of stars) {
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawPlayer() {
  if (!player) return;
  
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
  
  // 绘制飞船
  ctx.fillStyle = CONFIG.player.color;
  ctx.shadowColor = CONFIG.player.color;
  ctx.shadowBlur = 15;
  
  ctx.beginPath();
  ctx.moveTo(0, -player.height / 2);
  ctx.lineTo(-player.width / 2, player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();
  
  // 飞船细节
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawAliens() {
  for (let alien of aliens) {
    ctx.save();
    ctx.translate(alien.x + alien.width / 2, alien.y + alien.height / 2);
    
    // 根据类型选择颜色
    const colors = ['#ff00ff', '#ff6600', '#ffff00', '#00ff00'];
    ctx.fillStyle = colors[alien.type];
    ctx.shadowColor = colors[alien.type];
    ctx.shadowBlur = 10;
    
    // 绘制外星人（简单的方块样式）
    ctx.fillRect(-alien.width / 2, -alien.height / 2, alien.width, alien.height);
    
    // 眼睛
    ctx.fillStyle = '#000000';
    ctx.fillRect(-10, -5, 6, 6);
    ctx.fillRect(4, -5, 6, 6);
    
    ctx.restore();
  }
}

function drawBullets() {
  ctx.fillStyle = CONFIG.bullet.color;
  ctx.shadowColor = CONFIG.bullet.color;
  ctx.shadowBlur = 10;
  
  for (let bullet of bullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  
  ctx.shadowBlur = 0;
}

function drawAlienBullets() {
  ctx.fillStyle = CONFIG.alienBullet.color;
  ctx.shadowColor = CONFIG.alienBullet.color;
  ctx.shadowBlur = 10;
  
  for (let bullet of alienBullets) {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }
  
  ctx.shadowBlur = 0;
}

function drawLevelTransition() {
  // 半透明背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  
  // 绘制关卡提示
  ctx.save();
  ctx.fillStyle = '#00d4ff';
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`LEVEL ${level}`, CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 - 30);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.shadowBlur = 10;
  ctx.fillText('Get Ready!', CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2 + 30);
  ctx.restore();
}

// ==================== 音效 ====================
function playSound(type) {
  if (!soundEnabled) return;
  
  try {
    // 使用全局AudioContext，避免重复创建
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') {
      // AudioContext不可用时静默失败，不影响游戏
      return;
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
  
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch (type) {
      case 'shoot':
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      case 'explosion':
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 200;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
        break;
      case 'hit':
        oscillator.type = 'square';
        oscillator.frequency.value = 100;
        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'levelUp':
        oscillator.frequency.value = 523.25;
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        oscillator.stop(ctx.currentTime + 0.4);
        break;
    }
  } catch (e) {
    // 音频API错误不影响游戏
    console.warn('Audio playback failed:', e);
  }
}

// ==================== 显示更新 ====================
function updateDisplay() {
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
  levelDisplay.textContent = level;
  highScoreDisplay.textContent = highScore;
  
  // 更新心形显示
  updateHeartsDisplay();
}

function updateHeartsDisplay() {
  if (!heartsContainer) return;
  
  // 只在生命值改变时更新DOM（性能优化）
  if (lastLives === lives) return;
  
  lastLives = lives;
  heartsContainer.innerHTML = '';
  
  for (let i = 0; i < lives; i++) {
    const heart = document.createElement('span');
    heart.textContent = '❤️';
    heart.className = 'heart-icon';
    heartsContainer.appendChild(heart);
  }

// Made by SinceraXY
}

// ==================== 本地存储 ====================
function saveHighScore() {
  try {
    localStorage.setItem('spaceInvadersHighScore', highScore.toString());
  } catch (e) {
    console.log('无法保存最高分');
  }
}

function loadHighScore() {
  try {
    const saved = localStorage.getItem('spaceInvadersHighScore');
    if (saved) {
      highScore = parseInt(saved) || 0;
    }
  } catch (e) {
    console.log('无法加载最高分');
  }
}

// ==================== 返回主菜单 ====================
function quitToMenu() {
  gameActive = false;
  gamePaused = false;
  levelTransition = false;
  displayDirty = false;
  score = 0;
  lives = 3;
  lastLives = -1; // 强制更新hearts
  level = 1;
  alienSpeed = CONFIG.alien.speed;
  
  updateDisplay();
  startOverlay.classList.remove('hidden');
  pauseOverlay.classList.add('hidden');
  pauseBtn.querySelector('.btn-text').textContent = '暂停';
  pauseBtn.querySelector('.btn-icon').textContent = '⏸️';
  
  drawBackground();
}
