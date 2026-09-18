// ==================== 游戏配置 ====================
const CONFIG = {
  canvasWidth: 580,
  canvasHeight: 650,
  bubbleRadius: 20,
  bubbleSpeed: 8,
  // 优化颜色：选择对比度高、易区分的颜色
  bubbleColors: [
    '#FF0000',  // 纯红色
    '#0066FF',  // 深蓝色
    '#00CC00',  // 鲜绿色
    '#FFD700',  // 金黄色
    '#9900FF',  // 紫罗兰色
    '#FF6600',  // 橙色
    '#00CCCC'   // 青色
  ],
  initialRows: 5,
  bubblesPerRow: 14,
  rowHeight: 36,
  horizontalOffset: 21
};

// ==================== 游戏状态 ====================
let canvas = null;
let ctx = null;
let gameActive = false;
let gamePaused = false;
let soundEnabled = true;
let animationFrameId = null;

// ==================== 游戏数据 ====================
let score = 0;
let highScore = 0;
let level = 1;
let totalPopped = 0;
let maxCombo = 0;
let currentCombo = 0;

// ==================== 游戏对象 ====================
let bubbles = [];
let shooter = {
  x: CONFIG.canvasWidth / 2,
  y: CONFIG.canvasHeight - 50,
  angle: -Math.PI / 2,
  currentBubble: null,
  nextBubble: null
};
let projectile = null;

// ==================== 特效系统 ====================
let particles = [];
let floatingTexts = [];

// 粒子类
/* Dedicated to my girlfriend */
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4 - 2;
    this.radius = Math.random() * 3 + 2;
    this.color = color;
    this.alpha = 1;
    this.life = 1;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.2; // 重力
    this.alpha -= 0.02;
    this.life -= 0.02;
    return this.life > 0;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

// 浮动文字类
class FloatingText {
  constructor(text, x, y, color = '#FFD700', size = 20) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.vy = -2;
    this.color = color;
    this.size = size;
    this.alpha = 1;
    this.life = 1;
  }
  
  update() {
    this.y += this.vy;
    this.alpha -= 0.015;
    this.life -= 0.015;
    return this.life > 0;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }

/* Created by SinceraXY */
}

// DOM 元素
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverModal = document.getElementById('gameOverModal');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const soundBtn = document.getElementById('soundBtn');
const resumeBtn = document.getElementById('resumeBtn');
const pauseQuitBtn = document.getElementById('pauseQuitBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

// 显示元素
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const bubblesLeftDisplay = document.getElementById('bubblesLeft');
const highScoreDisplay = document.getElementById('highScore');

// ==================== 初始化 ====================
function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;
  
  // 加载最高分
  highScore = parseInt(localStorage.getItem('bubbleShooterHighScore') || '0');
  highScoreDisplay.textContent = highScore;
  
  setupEventListeners();
}

function setupEventListeners() {
  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', restartGame);
  soundBtn.addEventListener('click', toggleSound);
  resumeBtn.addEventListener('click', togglePause);
  pauseQuitBtn.addEventListener('click', quitToMenu);
  playAgainBtn.addEventListener('click', () => {
    closeModal(gameOverModal);
    startGame();
  });
  backToMenuBtn.addEventListener('click', () => {
    closeModal(gameOverModal);
    quitToMenu();
  });
  
  // 鼠标移动瞄准
  canvas.addEventListener('mousemove', handleMouseMove);
  // 点击发射
  canvas.addEventListener('click', handleClick);
}

// ==================== 游戏控制 ====================
function startGame() {
  // 取消旧的游戏循环
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  gameActive = true;
  gamePaused = false;
  score = 0;
  level = 1;
  totalPopped = 0;
  maxCombo = 0;
  currentCombo = 0;
  projectile = null;
  
  updateDisplay();
  startOverlay.classList.add('hidden');
  
  initLevel();
  gameLoop();
}

function initLevel() {
  bubbles = [];
  
  // 关卡难度计算
  const rowsToAdd = Math.floor(level / 3);  // 每3关增加1行
  const totalRows = CONFIG.initialRows + rowsToAdd;
  
  // 根据关卡调整颜色数量（增加难度）
  let colorCount = Math.min(CONFIG.bubbleColors.length, Math.max(4, 5 + Math.floor(level / 4)));
  const availableColors = CONFIG.bubbleColors.slice(0, colorCount);
  
  // 生成初始泡泡网格
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < CONFIG.bubblesPerRow; col++) {
      // 偶数行偏移
      const offset = row % 2 === 0 ? 0 : CONFIG.horizontalOffset;
      const x = offset + col * (CONFIG.bubbleRadius * 2 + 2) + CONFIG.bubbleRadius + 10;
      const y = row * CONFIG.rowHeight + CONFIG.bubbleRadius + 20;
      
      if (x + CONFIG.bubbleRadius < CONFIG.canvasWidth) {
        // 高关卡时，随机留空一些位置，增加挑战
        const shouldSkip = level > 5 && Math.random() < 0.05 * Math.floor(level / 5);
        
        if (!shouldSkip) {
          bubbles.push({
            x: x,
            y: y,
            color: availableColors[Math.floor(Math.random() * availableColors.length)],
            row: row,
            col: col
          });
        }

/* Made by SinceraXY */
      }
    }
  }
  
  // 初始化发射器泡泡
  shooter.currentBubble = createRandomBubble();
  shooter.nextBubble = createRandomBubble();
  shooter.angle = -Math.PI / 2;
  
  updateBubblesLeft();
  
  // 显示关卡提示
  if (level > 1) {
    showLevelNotification();
  }
}

// 显示关卡通知
function showLevelNotification() {
  const notification = document.createElement('div');
  notification.className = 'level-notification';
  notification.innerHTML = `
    <div class="level-notification-content">
      <div class="level-number">Level ${level}</div>
      <div class="level-info">
        ${level % 3 === 0 ? '🔥 更多泡泡！' : ''}
        ${level % 4 === 0 ? '🎨 更多颜色！' : ''}
        ${level > 5 && level % 5 === 0 ? '💎 稀疏布局！' : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

function createRandomBubble() {
  // 智能颜色选择：确保关卡可以结束
  
  // 获取场上实际存在的颜色
  const existingColors = getExistingColors();
  
  if (existingColors.length === 0) {
    // 没有泡泡了，随机返回
    return {
      color: CONFIG.bubbleColors[Math.floor(Math.random() * CONFIG.bubbleColors.length)]
    };
  }
  
  // 根据剩余泡泡数量调整策略
  if (bubbles.length <= 10) {
    // 剩余泡泡 <= 10个：100%使用现有颜色，确保可以消除
    return {
      color: existingColors[Math.floor(Math.random() * existingColors.length)]
    };
  } else if (bubbles.length <= 20) {
    // 剩余泡泡 <= 20个：90%使用现有颜色
    if (Math.random() < 0.9) {
      return {
        color: existingColors[Math.floor(Math.random() * existingColors.length)]
      };
    }
  } else {
    // 剩余泡泡较多：70%使用现有颜色（原策略）
    if (Math.random() < 0.7) {
      return {
        color: existingColors[Math.floor(Math.random() * existingColors.length)]
      };
    }
  }
  
  // 其他情况：从所有颜色中随机
  return {
    color: CONFIG.bubbleColors[Math.floor(Math.random() * CONFIG.bubbleColors.length)]
  };
}

// 获取场上实际存在的颜色
function getExistingColors() {
  const colorSet = new Set();
  for (let bubble of bubbles) {
    colorSet.add(bubble.color);
  }
  return Array.from(colorSet);
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
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  gameActive = false;
  gamePaused = false;
  startGame();
}

function quitToMenu() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  gameActive = false;
  gamePaused = false;
  pauseOverlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
  pauseBtn.querySelector('.btn-text').textContent = '暂停';
  pauseBtn.querySelector('.btn-icon').textContent = '⏸️';
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundBtn.querySelector('.btn-icon').textContent = soundEnabled ? '🔊' : '🔇';
  soundBtn.querySelector('.btn-text').textContent = soundEnabled ? '音效' : '静音';
}

function endGame() {
  gameActive = false;
  
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bubbleShooterHighScore', highScore);
    highScoreDisplay.textContent = highScore;
    document.getElementById('newHighScoreCard').classList.remove('hidden');
    document.getElementById('finalHighScore').textContent = highScore;
    document.getElementById('gameOverIcon').textContent = '🏆';
    document.getElementById('gameOverTitle').textContent = '新纪录！';
    document.getElementById('gameOverSubtitle').textContent = 'New High Score!';
  } else {
    document.getElementById('newHighScoreCard').classList.add('hidden');
    document.getElementById('gameOverIcon').textContent = '😢';
    document.getElementById('gameOverTitle').textContent = '游戏结束';
    document.getElementById('gameOverSubtitle').textContent = 'Game Over';
  }
  
  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalLevel').textContent = level;
  document.getElementById('totalPopped').textContent = totalPopped;
  document.getElementById('maxCombo').textContent = maxCombo;
  
  openModal(gameOverModal);
  playSound('gameOver');
}

function nextLevel() {
  level++;
  levelDisplay.textContent = level;
  
  // 奖励分数
  score += 1000 * level;
  scoreDisplay.textContent = score;
  
  playSound('levelUp');
  
  // 延迟初始化下一关
  setTimeout(() => {
    initLevel();
  }, 1000);
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (gameActive && !gamePaused) {
    update();
    draw();
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
  // 更新粒子效果
  particles = particles.filter(p => p.update());
  floatingTexts = floatingTexts.filter(t => t.update());
  
  // 更新发射的泡泡
  if (projectile) {
    projectile.x += Math.cos(projectile.angle) * CONFIG.bubbleSpeed;
    projectile.y += Math.sin(projectile.angle) * CONFIG.bubbleSpeed;
    
    // 墙壁反弹
    if (projectile.x - CONFIG.bubbleRadius <= 0) {
      projectile.x = CONFIG.bubbleRadius;
      projectile.angle = Math.PI - projectile.angle;
      playSound('bounce');
    } else if (projectile.x + CONFIG.bubbleRadius >= CONFIG.canvasWidth) {
      projectile.x = CONFIG.canvasWidth - CONFIG.bubbleRadius;
      projectile.angle = Math.PI - projectile.angle;
      playSound('bounce');
    }
    
    // 碰撞检测
    checkCollision();
    
    // 超出顶部
    if (projectile && projectile.y - CONFIG.bubbleRadius <= 0) {
      snapToGrid();
    }
  }
  
  // 检查游戏结束条件
  checkGameOver();
}

function checkCollision() {
  if (!projectile) return;
  
  for (let bubble of bubbles) {
    const dx = projectile.x - bubble.x;
    const dy = projectile.y - bubble.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < CONFIG.bubbleRadius * 2) {
      snapToGrid();
      return;
    }
  }
}

function snapToGrid() {
  if (!projectile) return;
  
  // 找到最近的网格位置
  let closestRow = Math.round((projectile.y - CONFIG.bubbleRadius - 20) / CONFIG.rowHeight);
  closestRow = Math.max(0, closestRow);
  
  const offset = closestRow % 2 === 0 ? 0 : CONFIG.horizontalOffset;
  let closestCol = Math.round((projectile.x - offset - CONFIG.bubbleRadius - 10) / (CONFIG.bubbleRadius * 2 + 2));
  closestCol = Math.max(0, Math.min(CONFIG.bubblesPerRow - 1, closestCol));
  
  const newX = offset + closestCol * (CONFIG.bubbleRadius * 2 + 2) + CONFIG.bubbleRadius + 10;
  const newY = closestRow * CONFIG.rowHeight + CONFIG.bubbleRadius + 20;
  
  // 添加新泡泡
  const newBubble = {
    x: newX,
    y: newY,
    color: projectile.color,
    row: closestRow,
    col: closestCol
  };
  
  bubbles.push(newBubble);
  projectile = null;
  
  // 检查消除
  setTimeout(() => {
    checkMatches(newBubble);
    updateBubblesLeft();
    
    // 准备下一个泡泡
    shooter.currentBubble = shooter.nextBubble;
    shooter.nextBubble = createRandomBubble();
  }, 50);
}

function checkMatches(bubble) {
  const matches = [];
  const visited = new Set();
  
  // BFS查找相同颜色的连接泡泡
  const queue = [bubble];
  visited.add(`${bubble.x},${bubble.y}`);
  
  while (queue.length > 0) {
    const current = queue.shift();
    matches.push(current);
    
    // 查找相邻泡泡
    const neighbors = getNeighbors(current);
    for (let neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(key) && neighbor.color === bubble.color) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }
  
  // 3个或以上消除
  if (matches.length >= 3) {
    currentCombo++;
    maxCombo = Math.max(maxCombo, currentCombo);
    
    // 移除匹配的泡泡并创建粒子效果
    for (let match of matches) {
      const index = bubbles.findIndex(b => b.x === match.x && b.y === match.y);
      if (index !== -1) {
        // 创建爆裂粒子
        createBurstParticles(match.x, match.y, match.color, 8);
        bubbles.splice(index, 1);
        totalPopped++;
      }

/* Made by SinceraXY */
    }
    
    // 计算分数
    const baseScore = matches.length * 10;
    const comboBonus = currentCombo * 50;
    const totalScore = baseScore + comboBonus;
    score += totalScore;
    scoreDisplay.textContent = score;
    
    // 显示得分文字
    const centerX = matches.reduce((sum, m) => sum + m.x, 0) / matches.length;
    const centerY = matches.reduce((sum, m) => sum + m.y, 0) / matches.length;
    createFloatingText(`+${totalScore}`, centerX, centerY, '#FFD700', 24);
    
    // 显示连击
    if (currentCombo > 1) {
      createFloatingText(`${currentCombo}x COMBO!`, centerX, centerY - 30, '#FF4500', 20);
    }
    
    playSound('pop');
    
    // 检查并移除孤立的泡泡
    setTimeout(() => {
      removeFloatingBubbles();
    }, 100);
    
    // 检查是否通关
    if (bubbles.length === 0) {
      setTimeout(() => {
        nextLevel();
      }, 500);
    }
  } else {
    currentCombo = 0;
  }
}

function getNeighbors(bubble) {
  const neighbors = [];
  const isEvenRow = bubble.row % 2 === 0;
  
  // 定义6个方向的偏移（六边形网格）
  const offsets = isEvenRow 
    ? [[-1, 0], [-1, -1], [0, -1], [1, 0], [0, 1], [-1, 1]]
    : [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 0]];
  
  for (let [colOffset, rowOffset] of offsets) {
    const newRow = bubble.row + rowOffset;
    const newCol = bubble.col + colOffset;
    
    const neighbor = bubbles.find(b => b.row === newRow && b.col === newCol);
    if (neighbor) {
      neighbors.push(neighbor);
    }
  }
  
  return neighbors;
}

function removeFloatingBubbles() {
  // 标记与顶部连接的泡泡
  const connected = new Set();
  const queue = [];
  
  // 从第一行开始BFS
  for (let bubble of bubbles) {
    if (bubble.row === 0) {
      queue.push(bubble);
      connected.add(`${bubble.x},${bubble.y}`);
    }
  }
  
  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = getNeighbors(current);
    
    for (let neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!connected.has(key)) {
        connected.add(key);
        queue.push(neighbor);
      }
    }
  }
  
  // 移除未连接的泡泡
  const floating = [];
  bubbles = bubbles.filter(bubble => {
    const key = `${bubble.x},${bubble.y}`;
    if (!connected.has(key)) {
      floating.push(bubble);
      return false;
    }
    return true;
  });
  
  // 掉落的泡泡加分和粒子效果
  if (floating.length > 0) {
    const dropScore = floating.length * 20 * currentCombo;
    score += dropScore;
    scoreDisplay.textContent = score;
    totalPopped += floating.length;
    
    // 为每个掉落的泡泡创建粒子效果

// Made with love

    for (let bubble of floating) {
      createBurstParticles(bubble.x, bubble.y, bubble.color, 6);
      createFloatingText(`+${20 * currentCombo}`, bubble.x, bubble.y, '#00CED1', 16);
    }
    
    playSound('drop');
  }
  
  updateBubblesLeft();
}

function checkGameOver() {
  // 检查泡泡是否接近底部
  for (let bubble of bubbles) {
    if (bubble.y + CONFIG.bubbleRadius >= shooter.y - CONFIG.bubbleRadius * 2) {
      endGame();
      return;
    }
  }
}

// ==================== 输入处理 ====================
function handleMouseMove(e) {
  if (!gameActive || gamePaused || projectile) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // 计算角度（限制在上半部分）
  let angle = Math.atan2(mouseY - shooter.y, mouseX - shooter.x);
  
  // 限制角度范围（-170度到-10度）
  const minAngle = -Math.PI * 0.95;
  const maxAngle = -Math.PI * 0.05;
  angle = Math.max(minAngle, Math.min(maxAngle, angle));
  
  shooter.angle = angle;
}

function handleClick(e) {
  if (!gameActive || gamePaused || projectile || !shooter.currentBubble) return;
  
  // 发射泡泡
  projectile = {
    x: shooter.x,
    y: shooter.y,
    color: shooter.currentBubble.color,
    angle: shooter.angle
  };
  
  playSound('shoot');
}

// ==================== 绘制 ====================
function draw() {
  // 清空画布
  ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  
  // 绘制背景
  drawBackground();
  
  // 绘制泡泡
  for (let bubble of bubbles) {
    drawBubble(bubble.x, bubble.y, bubble.color);
  }
  
  // 绘制发射的泡泡
  if (projectile) {
    drawBubble(projectile.x, projectile.y, projectile.color);
  }
  
  // 绘制发射器
  drawShooter();
  
  // 绘制瞄准线
  if (!projectile && shooter.currentBubble) {
    drawAimLine();
  }
  
  // 绘制粒子效果
  for (let particle of particles) {
    particle.draw(ctx);
  }
  
  // 绘制浮动文字
  for (let text of floatingTexts) {
    text.draw(ctx);
  }
  
  // 绘制连击显示
  if (currentCombo > 1 && gameActive && !gamePaused) {
    drawComboDisplay();
  }
}

function drawBackground() {
  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.canvasHeight);
  gradient.addColorStop(0, '#e0f7fa');
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
}

function drawBubble(x, y, color) {
  // 泡泡主体
  ctx.beginPath();
  ctx.arc(x, y, CONFIG.bubbleRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  
  // 泡泡边框
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // 高光效果
  ctx.beginPath();
  ctx.arc(x - 6, y - 6, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
}

function drawShooter() {
  // 发射器底座
  ctx.beginPath();
  ctx.arc(shooter.x, shooter.y, CONFIG.bubbleRadius + 5, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();
  
  // 当前泡泡
/* Author: SinceraXY */
  if (shooter.currentBubble) {
    drawBubble(shooter.x, shooter.y, shooter.currentBubble.color);
  }
  
  // 下一个泡泡（小一点）
  if (shooter.nextBubble) {
    const nextX = 50;
    const nextY = CONFIG.canvasHeight - 50;
    ctx.beginPath();
    ctx.arc(nextX, nextY, CONFIG.bubbleRadius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = shooter.nextBubble.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 文字提示
    ctx.fillStyle = '#666';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('下一个', nextX, nextY + CONFIG.bubbleRadius + 15);
  }
}

function drawAimLine() {
  ctx.save();
  
  // 绘制瞄准线路径（考虑墙壁反弹）
  let x = shooter.x;
  let y = shooter.y;
  let angle = shooter.angle;
  let bounces = 0;
  const maxBounces = 2;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  while (bounces <= maxBounces && y > 0) {
    const nextX = x + Math.cos(angle) * 500;
    const nextY = y + Math.sin(angle) * 500;
    
    // 检查墙壁碰撞
    if (nextX <= CONFIG.bubbleRadius) {
      const t = (CONFIG.bubbleRadius - x) / (nextX - x);
      const hitY = y + (nextY - y) * t;
      ctx.lineTo(CONFIG.bubbleRadius, hitY);
      x = CONFIG.bubbleRadius;
      y = hitY;
      angle = Math.PI - angle;
      bounces++;
    } else if (nextX >= CONFIG.canvasWidth - CONFIG.bubbleRadius) {
      const t = (CONFIG.canvasWidth - CONFIG.bubbleRadius - x) / (nextX - x);
      const hitY = y + (nextY - y) * t;
      ctx.lineTo(CONFIG.canvasWidth - CONFIG.bubbleRadius, hitY);
      x = CONFIG.canvasWidth - CONFIG.bubbleRadius;
      y = hitY;
      angle = Math.PI - angle;
      bounces++;
    } else {
      ctx.lineTo(nextX, nextY);
      break;
    }
  }
  
  // 优化瞄准线显示：增加对比度和清晰度
  // 先绘制黑色阴影（外描边）
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 5;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  
  // 再绘制亮色主线（内描边）
  ctx.strokeStyle = '#FFFF00';  // 明亮的黄色
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  
  ctx.restore();
}

// ==================== 辅助函数 ====================
function updateDisplay() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = level;
  highScoreDisplay.textContent = highScore;
  updateBubblesLeft();
}

function updateBubblesLeft() {
  bubblesLeftDisplay.textContent = bubbles.length;
}

function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

// ==================== 特效函数 ====================
function createBurstParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function createFloatingText(text, x, y, color, size) {
  floatingTexts.push(new FloatingText(text, x, y, color, size));
}

function drawComboDisplay() {
  const x = CONFIG.canvasWidth / 2;
  const y = 50;
  
  ctx.save();
  
  // 背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(x - 80, y - 25, 160, 40, 20);
  ctx.fill();
  
  // 文字
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText(`${currentCombo}x COMBO`, x, y);
  ctx.fillText(`${currentCombo}x COMBO`, x, y);
  
  ctx.restore();
}

function playSound(type) {
  if (!soundEnabled) return;
  
  // Web Audio API 音效生成
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'shoot':
        oscillator.frequency.value = 200;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'pop':
        oscillator.frequency.value = 400;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
      case 'bounce':
        oscillator.frequency.value = 150;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.08);
        break;
      case 'drop':
        oscillator.frequency.value = 300;
        oscillator.type = 'sawtooth';
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'levelUp':
        oscillator.frequency.value = 523;
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
      case 'gameOver':
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
    }
  } catch (e) {
    console.log('音效播放失败:', e);
  }
}

// ==================== 启动 ====================
window.addEventListener('load', init);
