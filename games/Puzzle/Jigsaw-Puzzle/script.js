// ==================== DOM元素 ====================
const timeEl = document.getElementById('time');
const movesEl = document.getElementById('moves');
const progressEl = document.getElementById('progress');

const previewCanvas = document.getElementById('preview-canvas');
const previewContainer = document.getElementById('preview-container');
const togglePreviewBtn = document.getElementById('toggle-preview');

const puzzleBoard = document.getElementById('puzzle-board');

const startBtn = document.getElementById('start-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const hintBtn = document.getElementById('hint-btn');
const resetBtn = document.getElementById('reset-btn');

const difficultyBtns = document.querySelectorAll('.difficulty-btn');

const completeModal = document.getElementById('complete-modal');
const finalTimeEl = document.getElementById('final-time');
const finalMovesEl = document.getElementById('final-moves');
const modalMessageEl = document.getElementById('modal-message');
const playAgainBtn = document.getElementById('play-again-btn');

// ==================== 游戏状态 ====================
let gameActive = false;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let moves = 0;
let selectedPiece = null;
let previewVisible = true;

// 难度设置
const difficulties = {
  easy: { gridSize: 3, name: "简单" },
  normal: { gridSize: 4, name: "普通" },
  hard: { gridSize: 5, name: "困难" }
};
let currentDifficulty = "normal";

// 拼图数据
let puzzleImage = null;
let puzzlePieces = [];
let pieceSize = 100;

// ==================== 初始化 ====================
/**
 * 初始化游戏
 */
function init() {
  setupEventListeners();
  createDefaultImage();
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  // 控制按钮
  startBtn.addEventListener('click', startGame);
  shuffleBtn.addEventListener('click', shufflePuzzle);
  hintBtn.addEventListener('click', showHint);
  resetBtn.addEventListener('click', resetGame);
  playAgainBtn.addEventListener('click', playAgain);
  togglePreviewBtn.addEventListener('click', togglePreview);

  // 难度选择
  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!gameActive) {
        setDifficulty(btn.dataset.difficulty);
      }

    });
  });
}

// ==================== 难度系统 ====================
/**
 * 设置难度
 */
function setDifficulty(difficulty) {
  currentDifficulty = difficulty;
  
  // 更新按钮状态
  difficultyBtns.forEach(btn => {
    if (btn.dataset.difficulty === difficulty) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

/* Developer: SinceraXY */
  });
}

// ==================== 图片处理 ====================
/**
 * 创建默认图片（渐变色）
 */
function createDefaultImage() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 400;
  canvas.height = 400;
  
  // 创建渐变背景
  const gradient = ctx.createLinearGradient(0, 0, 400, 400);
  gradient.addColorStop(0, '#8b5cf6');
  gradient.addColorStop(0.5, '#ec4899');
  gradient.addColorStop(1, '#f59e0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 400);
  
  // 添加一些图案
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 400;
    const y = Math.random() * 400;
    const r = Math.random() * 80 + 20;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 添加数字标记
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 60px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧩', 200, 200);
  
  puzzleImage = canvas;
  displayPreview();
}

/**
 * 显示预览图
 */
function displayPreview() {
  const ctx = previewCanvas.getContext('2d');
  const maxSize = 200;
  const scale = maxSize / puzzleImage.width;
  
  previewCanvas.width = puzzleImage.width * scale;
  previewCanvas.height = puzzleImage.height * scale;
  
  ctx.drawImage(puzzleImage, 0, 0, previewCanvas.width, previewCanvas.height);
}

/**
 * 切换预览显示
 */
function togglePreview() {
  previewVisible = !previewVisible;
  
  if (previewVisible) {
    previewContainer.classList.remove('hidden');
    togglePreviewBtn.textContent = '👁️ 隐藏';
  } else {
    previewContainer.classList.add('hidden');
    togglePreviewBtn.textContent = '👁️ 显示';
  }
}

// ==================== 游戏控制 ====================
/**
 * 开始游戏
 */
function startGame() {
  if (gameActive) return;
  
  gameActive = true;
  moves = 0;
  elapsedTime = 0;
  selectedPiece = null;
  
  updateDisplay();
  
  // 切换按钮显示
  startBtn.classList.add('hide');
  shuffleBtn.classList.remove('hide');
  hintBtn.classList.remove('hide');
  resetBtn.classList.remove('hide');
  
  // 创建拼图
  createPuzzle();
  
  // 启动计时器
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 100);
}

/**
 * 重置游戏
 */
function resetGame() {
  gameActive = false;
  moves = 0;
  elapsedTime = 0;
  selectedPiece = null;
  
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  updateDisplay();
  
  // 清空拼图板
  puzzleBoard.innerHTML = '';
  puzzlePieces = [];
  
  // 重置按钮
  startBtn.classList.remove('hide');
  shuffleBtn.classList.add('hide');
  hintBtn.classList.add('hide');
  resetBtn.classList.add('hide');
}

/**
 * 再玩一次
 */
function playAgain() {
  hideCompleteModal();
  resetGame();
  startGame();
}

// ==================== 拼图逻辑 ====================
/**
 * 创建拼图
 */
function createPuzzle() {
  const gridSize = difficulties[currentDifficulty].gridSize;
  pieceSize = Math.floor(puzzleImage.width / gridSize);
  
  // 设置拼图板样式
  puzzleBoard.style.gridTemplateColumns = `repeat(${gridSize}, ${pieceSize}px)`;
  puzzleBoard.style.gridTemplateRows = `repeat(${gridSize}, ${pieceSize}px)`;
  puzzleBoard.innerHTML = '';
  
  // 创建拼图块
  puzzlePieces = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const piece = {
        id: row * gridSize + col,
        correctRow: row,
        correctCol: col,
        currentRow: row,
        currentCol: col,
        element: null
      };
      puzzlePieces.push(piece);
    }

// Author: SinceraXY | China University of Petroleum, Beijing
  }
  
  // 打乱拼图
  shufflePuzzle();
}

/**
 * 打乱拼图
 */
function shufflePuzzle() {
  if (!gameActive) return;
  
  const gridSize = difficulties[currentDifficulty].gridSize;
  
  // 随机打乱位置
  for (let i = puzzlePieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    
    // 交换位置
    const tempRow = puzzlePieces[i].currentRow;
    const tempCol = puzzlePieces[i].currentCol;
    
    puzzlePieces[i].currentRow = puzzlePieces[j].currentRow;
    puzzlePieces[i].currentCol = puzzlePieces[j].currentCol;
    
    puzzlePieces[j].currentRow = tempRow;
    puzzlePieces[j].currentCol = tempCol;
  }
  
  renderPuzzle();
  updateProgress();
}

/**
 * 渲染拼图
 */
function renderPuzzle() {
  const gridSize = difficulties[currentDifficulty].gridSize;
  
  // 清空现有拼图
  puzzleBoard.innerHTML = '';
  
  // 按当前位置排序
  const sortedPieces = [...puzzlePieces].sort((a, b) => {
    if (a.currentRow !== b.currentRow) {
      return a.currentRow - b.currentRow;
    }
    return a.currentCol - b.currentCol;
  });
  
  // 渲染每个拼图块
  sortedPieces.forEach(piece => {
// Dedicated to my girlfriend
    const canvas = document.createElement('canvas');
    canvas.width = pieceSize;
    canvas.height = pieceSize;
    canvas.className = 'puzzle-piece';
    canvas.dataset.pieceId = piece.id;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      puzzleImage,
      piece.correctCol * pieceSize,
      piece.correctRow * pieceSize,
      pieceSize,
      pieceSize,
      0,
      0,
      pieceSize,
      pieceSize
    );
    
    // 添加点击事件
    canvas.addEventListener('click', () => handlePieceClick(piece));
    
    piece.element = canvas;
    puzzleBoard.appendChild(canvas);
  });
}

/**
 * 处理拼图块点击
 */
function handlePieceClick(piece) {
  if (!gameActive) return;
  
  if (!selectedPiece) {
    // 选中第一个块
    selectedPiece = piece;
    piece.element.classList.add('selected');
  } else if (selectedPiece.id === piece.id) {
    // 取消选中
    selectedPiece.element.classList.remove('selected');
    selectedPiece = null;
  } else {
    // 检查是否相邻
    const rowDiff = Math.abs(selectedPiece.currentRow - piece.currentRow);
    const colDiff = Math.abs(selectedPiece.currentCol - piece.currentCol);
    
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // 交换位置
      swapPieces(selectedPiece, piece);
      selectedPiece.element.classList.remove('selected');
      selectedPiece = null;
      moves++;
      updateDisplay();
      updateProgress();
      
      // 检查是否完成
      if (checkComplete()) {
        completeGame();
      }

/* Developer: SinceraXY */
    } else {
      // 不相邻，切换选中
      selectedPiece.element.classList.remove('selected');
      selectedPiece = piece;
      piece.element.classList.add('selected');
    }
  }
}

/**
 * 交换两个拼图块
 */
function swapPieces(piece1, piece2) {
  const tempRow = piece1.currentRow;
  const tempCol = piece1.currentCol;
  
  piece1.currentRow = piece2.currentRow;
  piece1.currentCol = piece2.currentCol;
  
  piece2.currentRow = tempRow;
  piece2.currentCol = tempCol;
  
  renderPuzzle();
}

/**
 * 检查是否完成
 */
function checkComplete() {
  return puzzlePieces.every(piece => 
    piece.currentRow === piece.correctRow && 
    piece.currentCol === piece.correctCol
  );
}

/**
 * 更新完成度
 */
function updateProgress() {
  const correctCount = puzzlePieces.filter(piece => 
    piece.currentRow === piece.correctRow && 
    piece.currentCol === piece.correctCol
  ).length;
  
  const percentage = Math.round((correctCount / puzzlePieces.length) * 100);
  progressEl.textContent = `${percentage}%`;
}

/**
 * 显示提示
 */
function showHint() {
  if (!gameActive) return;
  
  // 移除之前的提示
  puzzlePieces.forEach(piece => {
    if (piece.element) {
      piece.element.classList.remove('correct', 'wrong');
    }
  });
  
  // 显示新提示
  setTimeout(() => {
    puzzlePieces.forEach(piece => {
      if (piece.element) {
        if (piece.currentRow === piece.correctRow && piece.currentCol === piece.correctCol) {
          piece.element.classList.add('correct');
        } else {
          piece.element.classList.add('wrong');
        }
      }
    });
    
    // 3秒后移除提示
    setTimeout(() => {
      puzzlePieces.forEach(piece => {
        if (piece.element) {
          piece.element.classList.remove('correct', 'wrong');
        }
      });
    }, 3000);
  }, 100);
}

/**
 * 游戏完成
 */
function completeGame() {
  gameActive = false;
  


  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  showCompleteModal();
}

// ==================== UI更新 ====================
/**
 * 更新显示
 */
function updateDisplay() {
  movesEl.textContent = moves;
  updateTimer();
}

/**
 * 更新计时器
 */
function updateTimer() {
  if (gameActive && !timerInterval) return;
  
  if (gameActive) {
    elapsedTime = Date.now() - startTime;
  }
  
  const seconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ==================== 弹窗控制 ====================
/**
 * 显示完成弹窗
 */
function showCompleteModal() {
  const seconds = Math.floor(elapsedTime / 1000);
/* Author: SinceraXY */
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  finalTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  finalMovesEl.textContent = moves;
  
  // 根据效率给出评价
  const gridSize = difficulties[currentDifficulty].gridSize;
  const idealMoves = gridSize * gridSize * 2;
  
  let message = "";
  if (moves <= idealMoves) {
    message = "🏆 完美！效率极高！";
  } else if (moves <= idealMoves * 1.5) {
    message = "🌟 很棒！拼图高手！";
  } else if (moves <= idealMoves * 2) {
    message = "👍 不错！继续加油！";
  } else {
    message = "💪 完成了！多练习会更好！";
  }
  
  modalMessageEl.textContent = message;
  completeModal.classList.remove('hide');
}

/**
 * 隐藏完成弹窗
 */
function hideCompleteModal() {
  completeModal.classList.add('hide');
}

// ==================== 启动 ====================
init();
