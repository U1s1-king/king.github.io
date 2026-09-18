// ==================== 游戏配置 ====================
const CONFIG = {
  cellSize: 30,
  difficulties: {
    1: { name: '简单', size: 10 },
    2: { name: '中等', size: 15 },
    3: { name: '困难', size: 20 }
  },
  colors: {
    wall: '#2c3e50',
    path: '#ecf0f1',
    player: '#3498db',
    start: '#2ecc71',
    end: '#e74c3c',
    hint: '#f39c12',
    visited: '#95a5a6'
  }
};

// ==================== 游戏状态 ====================
let gameActive = false;
let currentLevel = 1;
let difficulty = 1;
let mazeSize = 10;
let steps = 0;
let startTime = null;
let timerInterval = null;
let levelProgress = {};

// 迷宫数据
let maze = [];
let player = { x: 0, y: 0 };
let startPos = { x: 0, y: 0 };
let endPos = { x: 0, y: 0 };
let solution = [];
let hintShown = false;
let hintTimer = null;
let hintsRemaining = 3;
let hintsUsed = 0;
let visitedCells = new Set();

// 粒子系统
/* GitHub: https://github.com/SinceraXY/GameHub */
let particles = [];
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.size = Math.random() * 4 + 2;
    this.color = color;
    this.alpha = 1;
    this.life = 1;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.02;
    this.life -= 0.02;
    return this.life > 0;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

/* Author: SinceraXY | China University of Petroleum, Beijing */
}

// ==================== DOM 元素 ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startOverlay = document.getElementById('startOverlay');
const winModal = document.getElementById('winModal');
const gameOverlay = document.getElementById('gameOverlay');

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const hintBtn = document.getElementById('hintBtn');
const menuBtn = document.getElementById('menuBtn');
const skipBtn = document.getElementById('skipBtn');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const replayBtn = document.getElementById('replayBtn');

const levelDisplay = document.getElementById('level');
const stepsDisplay = document.getElementById('steps');
const timeDisplay = document.getElementById('time');
const bestStepsDisplay = document.getElementById('bestSteps');

// ==================== 初始化 ====================
function init() {
  loadProgress();
  setupEventListeners();
  setupMobileControls();
}

function setupEventListeners() {
  startBtn.addEventListener('click', () => {
    closeModal(startOverlay);
    startGame();
  });

  resetBtn.addEventListener('click', resetToStart);
  hintBtn.addEventListener('click', showHint);
  menuBtn.addEventListener('click', backToMenu);
  skipBtn.addEventListener('click', nextLevel);
  nextLevelBtn.addEventListener('click', nextLevel);
  replayBtn.addEventListener('click', () => {
    closeModal(winModal);
    resetToStart();  // 改为resetToStart，迷宫保持不变
  });

  // 难度选择
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      difficulty = parseInt(this.dataset.level);
      mazeSize = CONFIG.difficulties[difficulty].size;
    });
  });

  // 键盘控制
  document.addEventListener('keydown', handleKeyPress);
}

function setupMobileControls() {
  document.querySelectorAll('.d-pad-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const dir = this.dataset.dir;
      if (dir) {
        handleMove(dir);
      }
    });
  });
}

// ==================== 游戏控制 ====================
function startGame() {
  gameActive = true;
  currentLevel = 1;
  difficulty = difficulty || 1;
  mazeSize = CONFIG.difficulties[difficulty].size;
  
  resetLevel();
  hideOverlay();
}

function resetLevel() {
  steps = 0;
  startTime = Date.now();
  hintShown = false;
  hintSteps = 0;
  hintsRemaining = 3;
  hintsUsed = 0;
  solution = [];
  visitedCells = new Set();
  particles = [];
  
  generateMaze();
  updateDisplay();
  startTimer();
  gameActive = true;
}

// 重置到起点（不重新生成迷宫）
function resetToStart() {
  // 清除提示计时器
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  
  // 重置玩家位置
  player = { ...startPos };
  
  // 重置游戏状态
  steps = 0;
  startTime = Date.now();
  hintShown = false;
  visitedCells = new Set();
  particles = [];
  
  // 重置提示次数和使用次数
  hintsRemaining = 3;
  hintsUsed = 0;
  
  updateDisplay();
  startTimer();
  drawMaze();
  gameActive = true;
}

function nextLevel() {
  closeModal(winModal);
  currentLevel++;
  resetLevel();
}

function backToMenu() {
  // 停止游戏
  gameActive = false;

// Made with love

  stopTimer();
  
  // 清除提示计时器
  if (hintTimer) {
    clearTimeout(hintTimer);
    hintTimer = null;
  }
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 重置所有状态
  currentLevel = 1;
  steps = 0;
  hintShown = false;
  hintSteps = 0;
  hintsRemaining = 3;
  hintsUsed = 0;
  
  updateDisplay();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  showOverlay();
  openModal(startOverlay);
}

// ==================== 迷宫生成 ====================
function generateMaze() {
  // 初始化迷宫（全是墙）
  maze = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(1));
  
  // 调整迷宫大小为奇数，避免边界多余黑边
  if (mazeSize % 2 === 0) {
    mazeSize -= 1;
  }
  
  // 设置起点和终点
  startPos = { x: 0, y: 0 };
  endPos = { x: mazeSize - 1, y: mazeSize - 1 };
  player = { ...startPos };
  
  // 使用深度优先搜索生成迷宫
  const stack = [startPos];
  maze[startPos.y][startPos.x] = 0;
  
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(current);
    
    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      
      // 移除墙壁
      const wallX = Math.floor(current.x + (next.x - current.x) / 2);
      const wallY = Math.floor(current.y + (next.y - current.y) / 2);
      maze[wallY][wallX] = 0;
      maze[next.y][next.x] = 0;
      
      stack.push(next);
    }
  }
  
  // 确保终点可达
  maze[endPos.y][endPos.x] = 0;
  if (endPos.x > 0) maze[endPos.y][endPos.x - 1] = 0;
  if (endPos.y > 0) maze[endPos.y - 1][endPos.x] = 0;
  
  // 计算唯一的正确路径
  solution = findPath();
  
  // 增加迷宫难度：添加死胡同作为干扰
  addDeadEnds();
  
  // 设置画布大小
  const totalSize = mazeSize * CONFIG.cellSize;
  canvas.width = totalSize;
  canvas.height = totalSize;
  
  drawMaze();
}

function getUnvisitedNeighbors(pos) {
  const neighbors = [];
  const directions = [
    { x: 0, y: -2 },  // 上
    { x: 2, y: 0 },   // 右
    { x: 0, y: 2 },   // 下
    { x: -2, y: 0 }   // 左
  ];
  
  for (let dir of directions) {
    const nx = pos.x + dir.x;
    const ny = pos.y + dir.y;
    
    if (nx >= 0 && nx < mazeSize && ny >= 0 && ny < mazeSize && maze[ny][nx] === 1) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}

// 添加死胡同作为干扰路径（不创建新的到达终点的路径）
function addDeadEnds() {
  // 将solution转换为Set以便快速查找
  const solutionSet = new Set(solution.map(pos => `${pos.x},${pos.y}`));
  
  // 计算要添加的死胡同数量
  const deadEndCount = Math.floor(mazeSize * 1.5); // 根据迷宫大小添加死胡同
  let added = 0;
  let attempts = 0;
  const maxAttempts = deadEndCount * 10; // 避免无限循环
  
  while (added < deadEndCount && attempts < maxAttempts) {
    attempts++;
    
    // 随机选择一个现有路径格子
    const pathCells = [];
    for (let y = 0; y < mazeSize; y++) {
      for (let x = 0; x < mazeSize; x++) {
        if (maze[y][x] === 0) {
          pathCells.push({ x, y });
        }
      }
    }
    
    if (pathCells.length === 0) break;
    
    const startCell = pathCells[Math.floor(Math.random() * pathCells.length)];
    
    // 尝试在4个方向添加死胡同
    const directions = [
      { x: 0, y: -1 },  // 上
      { x: 1, y: 0 },   // 右
      { x: 0, y: 1 },   // 下
      { x: -1, y: 0 }   // 左
    ];
    
    // 随机选择一个方向
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const wallX = startCell.x + dir.x;
    const wallY = startCell.y + dir.y;
    const deadEndX = startCell.x + dir.x * 2;
    const deadEndY = startCell.y + dir.y * 2;
    
    // 检查是否可以添加死胡同
    if (deadEndX >= 0 && deadEndX < mazeSize && 
        deadEndY >= 0 && deadEndY < mazeSize &&
        maze[wallY] && maze[wallY][wallX] === 1 &&
        maze[deadEndY] && maze[deadEndY][deadEndX] === 1) {
      
      // 确保死胡同不会连接到正确路径
      // 检查死胡同位置周围除了来的方向外是否都是墙
      let canAdd = true;
      for (let checkDir of directions) {
        if (checkDir.x === -dir.x && checkDir.y === -dir.y) continue; // 跳过来的方向
        
        const checkX = deadEndX + checkDir.x;
        const checkY = deadEndY + checkDir.y;
        
        if (checkX >= 0 && checkX < mazeSize && 
            checkY >= 0 && checkY < mazeSize &&
            maze[checkY] && maze[checkY][checkX] === 0) {
          canAdd = false;
          break;
        }
      }
      
      // 确保死胡同不在正确路径上
      const deadEndKey = `${deadEndX},${deadEndY}`;
      if (canAdd && !solutionSet.has(deadEndKey)) {
        maze[wallY][wallX] = 0;
        maze[deadEndY][deadEndX] = 0;
        added++;
      }
    }
  }
}

// ==================== 寻路算法（BFS） ====================
function findPath() {
  const queue = [{ ...startPos, path: [startPos] }];
  const visited = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(false));
  visited[startPos.y][startPos.x] = true;
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current.x === endPos.x && current.y === endPos.y) {
      return current.path;
    }
    
    const neighbors = getValidNeighbors(current);
    for (let next of neighbors) {
      if (!visited[next.y][next.x]) {
        visited[next.y][next.x] = true;
        queue.push({
          x: next.x,
          y: next.y,
          path: [...current.path, next]
        });
      }
    }
  }
  
  return [];
}

function getValidNeighbors(pos) {
  const neighbors = [];
  const directions = [
    { x: 0, y: -1 },  // 上
    { x: 1, y: 0 },   // 右
    { x: 0, y: 1 },   // 下
    { x: -1, y: 0 }   // 左
  ];
  
  for (let dir of directions) {
    const nx = pos.x + dir.x;
    const ny = pos.y + dir.y;
    
    if (nx >= 0 && nx < mazeSize && ny >= 0 && ny < mazeSize && maze[ny][nx] === 0) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}

// ==================== 绘制函数 ====================
function drawMaze() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 更新和绘制粒子
  particles = particles.filter(p => p.update());
  particles.forEach(p => p.draw(ctx));
  
  // 绘制迷宫
  for (let y = 0; y < mazeSize; y++) {
    for (let x = 0; x < mazeSize; x++) {
      const cellX = x * CONFIG.cellSize;
      const cellY = y * CONFIG.cellSize;
      
      if (maze[y][x] === 1) {
        // 墙壁 - 添加渐变效果
        const gradient = ctx.createLinearGradient(cellX, cellY, cellX + CONFIG.cellSize, cellY + CONFIG.cellSize);
        gradient.addColorStop(0, '#34495e');
        gradient.addColorStop(1, '#2c3e50');
        ctx.fillStyle = gradient;
        ctx.fillRect(cellX, cellY, CONFIG.cellSize, CONFIG.cellSize);
      } else {
        // 路径
        ctx.fillStyle = CONFIG.colors.path;
        ctx.fillRect(cellX, cellY, CONFIG.cellSize, CONFIG.cellSize);
        
        // 显示已访问的路径
        const cellKey = `${x},${y}`;
        if (visitedCells.has(cellKey)) {
          ctx.fillStyle = 'rgba(149, 165, 166, 0.3)';
          ctx.fillRect(cellX, cellY, CONFIG.cellSize, CONFIG.cellSize);
        }
      }
      
      // 网格线
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, CONFIG.cellSize, CONFIG.cellSize);
    }
  }
  
  // 绘制提示路径（从当前位置开始）
  if (hintShown && currentHintPath.length > 0 && hintSteps > 0) {
    const endIndex = Math.min(hintSteps, currentHintPath.length);
    
    if (endIndex > 0) {
      ctx.strokeStyle = CONFIG.colors.hint;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([5, 5]); // 虚线效果
      
      ctx.beginPath();
      for (let i = 0; i < endIndex; i++) {
        const pos = currentHintPath[i];
        const x = pos.x * CONFIG.cellSize + CONFIG.cellSize / 2;
        const y = pos.y * CONFIG.cellSize + CONFIG.cellSize / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]); // 重置虚线
      
      // 在提示终点绘制一个圆点
      if (endIndex < currentHintPath.length || endIndex === currentHintPath.length) {
        const lastPos = currentHintPath[endIndex - 1];
        const x = lastPos.x * CONFIG.cellSize + CONFIG.cellSize / 2;
        const y = lastPos.y * CONFIG.cellSize + CONFIG.cellSize / 2;
        
        ctx.fillStyle = CONFIG.colors.hint;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 添加外层光晕
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

    }
  }
  
  // 绘制起点
  drawCircle(startPos.x, startPos.y, CONFIG.colors.start);
  
  // 绘制终点
  drawCircle(endPos.x, endPos.y, CONFIG.colors.end);
  
  // 绘制玩家
// Developer: SinceraXY - CUPB
  drawPlayer();
}

function drawCircle(x, y, color) {
  const centerX = x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const radius = CONFIG.cellSize / 3;
  
  // 绘制脉冲光晕
  const time = Date.now() / 1000;
  const pulseRadius = radius + Math.sin(time * 3) * 3;
  
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  
  // 外层光晕
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // 内层实心
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

function drawPlayer() {
  const centerX = player.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = player.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const radius = CONFIG.cellSize / 2.5;
  
  ctx.save();
  
  // 绘制外层光晕（动态脉冲）
  const time = Date.now() / 1000;
  const glowRadius = radius + Math.sin(time * 4) * 2;
  
  ctx.shadowColor = CONFIG.colors.player;
  ctx.shadowBlur = 20;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = CONFIG.colors.player;
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // 绘制玩家主体（渐变）
  ctx.globalAlpha = 1;
  const gradient = ctx.createRadialGradient(centerX - radius / 3, centerY - radius / 3, 0, centerX, centerY, radius);
  gradient.addColorStop(0, '#5dade2');
  gradient.addColorStop(1, '#3498db');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.shadowBlur = 0;
  
  // 绘制眼睛
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 5, 0, Math.PI * 2);
  ctx.arc(centerX + radius / 3, centerY - radius / 3, radius / 5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(centerX - radius / 3, centerY - radius / 3, radius / 8, 0, Math.PI * 2);
  ctx.arc(centerX + radius / 3, centerY - radius / 3, radius / 8, 0, Math.PI * 2);
  ctx.fill();
  
  // 绘制微笑
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius / 2, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  
  ctx.restore();
}

// ==================== 玩家移动 ====================
function handleKeyPress(e) {
  if (!gameActive) return;
  
  const key = e.key.toLowerCase();
  
  switch (key) {
    case 'arrowup':
    case 'w':
      e.preventDefault();
      handleMove('up');
      break;
    case 'arrowdown':
    case 's':
      e.preventDefault();
      handleMove('down');
      break;
    case 'arrowleft':
    case 'a':
      e.preventDefault();
      handleMove('left');
      break;
    case 'arrowright':
    case 'd':
      e.preventDefault();
      handleMove('right');
      break;
  }
}

function handleMove(direction) {
  if (!gameActive) return;
  
  let newX = player.x;
  let newY = player.y;
  
  switch (direction) {
    case 'up':
      newY--;
      break;
    case 'down':
      newY++;
      break;
    case 'left':
      newX--;
      break;
    case 'right':
      newX++;
      break;
  }
  
  // 检查是否可以移动
  if (isValidMove(newX, newY)) {
    // 记录访问的格子
    const oldCellKey = `${player.x},${player.y}`;
    visitedCells.add(oldCellKey);
    
    // 创建移动粒子效果
    createMoveParticles(player.x, player.y);
    
    player.x = newX;
    player.y = newY;
    steps++;
    updateDisplay();
    playSound('move');
    
    // 检查是否到达终点
    if (player.x === endPos.x && player.y === endPos.y) {
      createVictoryParticles();
      setTimeout(() => {
        win();
      }, 300);
    }
  } else {
    // 碰撞墙壁时的震动效果
    createWallHitEffect(newX, newY);
    playSound('wall');
  }
  
  // 启动动画循环
  requestAnimationFrame(animateGame);
}

// 动画循环
function animateGame() {
  if (gameActive) {
    drawMaze();
  }
}

// 创建移动粒子
function createMoveParticles(x, y) {
  const centerX = x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = y * CONFIG.cellSize + CONFIG.cellSize / 2;
  
  for (let i = 0; i < 5; i++) {
    particles.push(new Particle(centerX, centerY, CONFIG.colors.player));
  }
}

// 创建胜利粒子
function createVictoryParticles() {
  const centerX = endPos.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = endPos.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(centerX, centerY, color));
    }, i * 20);
  }
}

// 创建墙壁碰撞效果
function createWallHitEffect(x, y) {
  if (x >= 0 && x < mazeSize && y >= 0 && y < mazeSize) {
    const centerX = x * CONFIG.cellSize + CONFIG.cellSize / 2;
    const centerY = y * CONFIG.cellSize + CONFIG.cellSize / 2;
    
    for (let i = 0; i < 3; i++) {
      particles.push(new Particle(centerX, centerY, '#e74c3c'));
    }
  }
}

function isValidMove(x, y) {
  return x >= 0 && x < mazeSize && y >= 0 && y < mazeSize && maze[y][x] === 0;
}

// ==================== 提示系统 ====================
let currentHintPath = []; // 当前提示路径
let hintSteps = 0; // 提示显示的步数

function showHint() {
  if (!gameActive) return;
  
  // 检查提示次数
  if (hintsRemaining <= 0) {
    showMessage('❌ 提示次数已用完！');
    return;
  }
  
  // 从玩家当前位置重新计算到终点的路径
  currentHintPath = findPathFromPosition(player);
  
  if (currentHintPath.length === 0) {
    showMessage('❌ 无法找到路径！');
    return;
  }
  
  // 消耗一次提示
  hintsRemaining--;
  hintsUsed++;
  updateDisplay();
  
  // 计算显示步数：至少要显示到一个拐弯或路口
  const stepsToShow = calculateHintSteps(currentHintPath);
  hintSteps = stepsToShow;
  
  hintShown = true;
  playSound('hint');
  showMessage(`💡 显示接下来${stepsToShow}步路径！（剩余${hintsRemaining}次）`);
  
  // 清除之前的计时器
  if (hintTimer) {
    clearTimeout(hintTimer);
  }
  
  // 3秒后隐藏提示
  hintTimer = setTimeout(() => {
    hintShown = false;
    currentHintPath = [];
    drawMaze();
  }, 3000);
  
  drawMaze();
}

// 从指定位置寻找到终点的路径
function findPathFromPosition(fromPos) {
  const queue = [{ ...fromPos, path: [fromPos] }];
  const visited = Array(mazeSize).fill(null).map(() => Array(mazeSize).fill(false));
  visited[fromPos.y][fromPos.x] = true;
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    if (current.x === endPos.x && current.y === endPos.y) {
      return current.path;
    }
    
    const neighbors = getValidNeighbors(current);
    for (let next of neighbors) {
      if (!visited[next.y][next.x]) {
        visited[next.y][next.x] = true;
        queue.push({
          x: next.x,
          y: next.y,
          path: [...current.path, next]
        });
      }
    }
  }
  
  return [];
}

// 计算提示显示的步数：至少包含一个拐弯或路口选择
function calculateHintSteps(path) {
  if (path.length <= 1) return path.length;
  
  let minSteps = 3; // 最少显示3步
  let maxSteps = Math.min(8, path.length); // 最多显示8步
  
  // 查找第一个拐弯或路口
  for (let i = 1; i < path.length - 1 && i < maxSteps; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    // 检查是否拐弯（方向改变）
    const dir1X = curr.x - prev.x;
    const dir1Y = curr.y - prev.y;
    const dir2X = next.x - curr.x;
    const dir2Y = next.y - curr.y;
    
    // 如果方向改变，说明是拐弯
    if (dir1X !== dir2X || dir1Y !== dir2Y) {
      // 至少显示到拐弯后的2步
      return Math.max(i + 2, minSteps);
    }
    
    // 检查是否是路口（当前位置有多个可选方向）
    const choices = countAvailableDirections(curr);
    if (choices > 2) { // 超过2个方向说明是路口
      // 至少显示到路口后的2步
      return Math.max(i + 2, minSteps);
    }
  }
  
  // 如果没有找到拐弯或路口，返回随机步数
  return Math.min(minSteps + Math.floor(Math.random() * 3), path.length);
}

// 计算某个位置有多少个可走的方向
function countAvailableDirections(pos) {
  let count = 0;
  const directions = [
    { x: 0, y: -1 },  // 上
    { x: 1, y: 0 },   // 右
    { x: 0, y: 1 },   // 下
    { x: -1, y: 0 }   // 左
  ];
  
  for (let dir of directions) {
    const newX = pos.x + dir.x;
    const newY = pos.y + dir.y;
    if (isValidMove(newX, newY)) {
      count++;
    }
  }
  
  return count;
}

// ==================== 胜利检查 ====================
function win() {
  gameActive = false;
  stopTimer();
  
  // 显示胜利弹窗
  const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('winLevel').textContent = currentLevel;
  document.getElementById('winSteps').textContent = steps;
  document.getElementById('winTime').textContent = formatTime(elapsedTime);
  document.getElementById('winHintUsed').textContent = `${hintsUsed}次`;
  
  playSound('win');
  openModal(winModal);
}

// ==================== 计时器 ====================
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (gameActive && startTime) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeDisplay.textContent = formatTime(elapsed);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ==================== 显示更新 ====================
function updateDisplay() {
  levelDisplay.textContent = currentLevel;
  stepsDisplay.textContent = steps;
  
  // 更新提示次数显示
  const hintsLeftDisplay = document.getElementById('hintsLeft');
  if (hintsLeftDisplay) {
    hintsLeftDisplay.textContent = hintsRemaining;
  }
  
  // 步数动画
  if (steps > 0) {
    stepsDisplay.style.transform = 'scale(1.3)';
    stepsDisplay.style.color = '#FFD93D';
    setTimeout(() => {
      stepsDisplay.style.transform = 'scale(1)';
      stepsDisplay.style.color = 'white';
    }, 200);
  }
}

// ==================== 音效系统 ====================
function playSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'move':
        oscillator.frequency.value = 400;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
        break;
      case 'wall':
        oscillator.frequency.value = 150;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
      case 'hint':
        oscillator.frequency.value = 600;
        oscillator.type = 'triangle';
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'win':
        [523, 659, 784].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, audioContext.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.4);
          osc.start(audioContext.currentTime + i * 0.15);
          osc.stop(audioContext.currentTime + i * 0.15 + 0.4);
        });
        return;
    }
  } catch (e) {
    console.log('音效播放失败:', e);
  }
}

// ==================== 消息提示 ====================
function showMessage(message) {
  const msg = document.createElement('div');
  msg.className = 'message-toast';
  msg.textContent = message;
  msg.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px 30px;
    border-radius: 10px;
/* Dedicated to my girlfriend */
    font-size: 1.1rem;
    z-index: 3000;
    animation: fadeInOut 2s ease;
  `;
  
  document.body.appendChild(msg);
  
  setTimeout(() => {
    msg.remove();
  }, 2000);
}

// ==================== 进度保存 ====================
function saveProgress() {
  localStorage.setItem('mazeEscapeProgress', JSON.stringify(levelProgress));
}

function loadProgress() {
  const saved = localStorage.getItem('mazeEscapeProgress');
  if (saved) {
    levelProgress = JSON.parse(saved);
  }
}

// ==================== 覆盖层控制 ====================
function showOverlay() {
  gameOverlay.style.display = 'block';
}

function hideOverlay() {
  gameOverlay.style.display = 'none';
}

// ==================== 辅助函数 ====================
function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0%, 100% { opacity: 0; }
    10%, 90% { opacity: 1; }
  }
`;
document.head.appendChild(style);

// ==================== 启动 ====================
window.addEventListener('load', init);
