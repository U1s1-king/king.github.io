// ==================== 游戏状态 ====================
let board = []; // 当前游戏板（玩家看到的）
let solution = []; // 完整解答
let fixedCells = []; // 固定的格子（初始数字）
let selectedCell = null; // 当前选中的格子
let checkCount = 0; // 检查次数（累计错误次数）
let hintsRemaining = 3; // 剩余提示次数
let gameActive = false; // 游戏是否激活
let timer = null; // 计时器
let seconds = 0; // 已用时间（秒）
let difficulty = 'easy'; // 当前难度
let moveHistory = []; // 移动历史（用于撤销）

// 难度配置
const difficultyConfig = {
  easy: { emptyCells: 40, name: '简单' },
  medium: { emptyCells: 50, name: '中等' },
  hard: { emptyCells: 60, name: '困难' }
};

// ==================== DOM 元素 ====================
const sudokuGrid = document.getElementById('sudokuGrid');
const timeDisplay = document.getElementById('time');
const mistakesDisplay = document.getElementById('mistakes');
const difficultyDisplay = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const hintBtn = document.getElementById('hintBtn');
const undoBtn = document.getElementById('undoBtn');
const checkBtn = document.getElementById('checkBtn');
const difficultyModal = document.getElementById('difficultyModal');
const gameOverModal = document.getElementById('gameOverModal');
const playAgainBtn = document.getElementById('playAgainBtn');
const numberBtns = document.querySelectorAll('.number-btn');
const difficultyBtns = document.querySelectorAll('.difficulty-btn');

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
  attachEventListeners();
});

function initializeGame() {
  showDifficultyModal();
}

function attachEventListeners() {
  // 新游戏按钮
  newGameBtn.addEventListener('click', () => {
    showDifficultyModal();
  });

  // 提示按钮
  hintBtn.addEventListener('click', () => {
    giveHint();
  });

  // 撤销按钮
  undoBtn.addEventListener('click', () => {
    undoMove();
  });

  // 检查按钮
  checkBtn.addEventListener('click', () => {
    checkBoard();
  });

  // 数字按钮
  numberBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const number = parseInt(btn.dataset.number);
      if (selectedCell !== null) {
        placeNumber(number);
      }
      // 高亮选中的数字按钮
      numberBtns.forEach(b => b.classList.remove('selected'));
      if (number !== 0) {
        btn.classList.add('selected');
      }
    });
  });

  // 难度选择按钮
  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.difficulty;
      startNewGame();
    });
  });

  // 再玩一次按钮
  playAgainBtn.addEventListener('click', () => {
    closeModal(gameOverModal);
    showDifficultyModal();
  });

  // 键盘输入
  document.addEventListener('keydown', (e) => {
    if (!gameActive || selectedCell === null) return;
    
    const key = e.key;
    if (key >= '1' && key <= '9') {
      placeNumber(parseInt(key));
    } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
      placeNumber(0);
    } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      moveSelection(key);
    }
  });
}

// ==================== 模态框 ====================
function showDifficultyModal() {
  difficultyModal.classList.add('active');
}

function showGameOverModal(won) {
  const icon = document.getElementById('gameOverIcon');
  const title = document.getElementById('gameOverTitle');
  const finalTime = document.getElementById('finalTime');
  const finalMistakes = document.getElementById('finalMistakes');

  // 现在游戏只有胜利，没有失败
  icon.textContent = '🎉';
  title.textContent = '恭喜完成！数独胜利！';

  finalTime.textContent = formatTime(seconds);
  finalMistakes.textContent = checkCount;

  gameOverModal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

// ==================== 游戏控制 ====================
function startNewGame() {
  // 关闭难度选择对话框
  closeModal(difficultyModal);
  
  // 重置游戏状态
  checkCount = 0;
  hintsRemaining = 3;
  seconds = 0;
  moveHistory = [];
  gameActive = true;
  selectedCell = null;
  
  // 更新显示
  difficultyDisplay.textContent = difficultyConfig[difficulty].name;
  updateDisplay();
  
  // 生成数独
  generateSudoku();
  
  // 渲染游戏板
  renderBoard();
  
  // 开始计时
  startTimer();
}

function endGame(won) {
  gameActive = false;
  stopTimer();
  showGameOverModal(won);
}

// ==================== 计时器 ====================
function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    seconds++;
    updateDisplay();
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== 显示更新 ====================
function updateDisplay() {
  timeDisplay.textContent = formatTime(seconds);
  mistakesDisplay.textContent = checkCount; // 显示累计检查错误次数
  undoBtn.disabled = moveHistory.length === 0;
  hintBtn.disabled = hintsRemaining <= 0;
  
  // 更新提示按钮文字
  const hintBtnText = hintBtn.querySelector('.btn-text');
  if (hintBtnText) {
    hintBtnText.textContent = `提示(${hintsRemaining})`;
  }
}

// ==================== 数独生成 ====================
function generateSudoku() {
  // 生成完整的数独解答
  solution = generateCompleteSudoku();
  
  // 复制解答到游戏板
  board = solution.map(row => [...row]);
  
  // 根据难度挖空
  const emptyCells = difficultyConfig[difficulty].emptyCells;
  createPuzzle(emptyCells);
}

function generateCompleteSudoku() {
  // 创建空的9x9数组
  const grid = Array(9).fill(0).map(() => Array(9).fill(0));
  
  // 使用回溯法填充数独
  fillSudoku(grid);
  
  return grid;
}

function fillSudoku(grid) {
  // 找到第一个空格
  const emptyCell = findEmptyCell(grid);
  
  if (!emptyCell) {
    return true; // 数独已完成
  }
  
  const [row, col] = emptyCell;
  
  // 随机尝试数字1-9
  const numbers = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  
  for (const num of numbers) {
    if (isValidMove(grid, row, col, num)) {
      grid[row][col] = num;
      
      if (fillSudoku(grid)) {
        return true;
      }
      
      grid[row][col] = 0; // 回溯
    }
  }
  
  return false;
}

function findEmptyCell(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        return [row, col];
      }
    }
  }

  return null;
}

function isValidMove(grid, row, col, num) {
  // 检查行
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) {
      return false;
    }
  }
  
  // 检查列
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) {
      return false;
    }
  }
  
  // 检查3x3宫格
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) {
        return false;
      }
    }
  }
  
  return true;
}

function createPuzzle(emptyCells) {
  // 随机移除数字以创建谜题
  let removed = 0;
  const attempts = [];
  
  // 初始化固定格子数组
  fixedCells = Array(9).fill(0).map(() => Array(9).fill(false));
  
  // 生成所有格子的坐标
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      attempts.push([row, col]);
    }
  }
  
  // 随机打乱坐标数组
  const shuffledAttempts = shuffleArray(attempts);
  
  // 移除数字
  for (const [row, col] of shuffledAttempts) {
    if (removed >= emptyCells) break;
    
    board[row][col] = 0;
    removed++;
  }
  
  // 标记剩余的数字为固定
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] !== 0) {
        fixedCells[row][col] = true;
      }
    }
  }
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// ==================== 渲染游戏板 ====================
function renderBoard() {
  sudokuGrid.innerHTML = '';
  
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = document.createElement('div');
      cell.className = 'sudoku-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      const value = board[row][col];
      
/* GitHub: https://github.com/SinceraXY/GameHub */
      if (value !== 0) {
        cell.textContent = value;
        // 如果是初始数字（固定的），添加fixed类
        if (fixedCells[row][col]) {
          cell.classList.add('fixed');
        }
      }
      
      // 添加点击事件
      cell.addEventListener('click', () => {
        if (!cell.classList.contains('fixed')) {
          selectCell(row, col);
        }

      });
      
      sudokuGrid.appendChild(cell);
    }
  }
  
  // 恢复选中状态
  if (selectedCell !== null) {
    const [row, col] = selectedCell;
    const cell = getCellElement(row, col);
    if (cell) {
      cell.classList.add('selected');
      highlightRelatedCells(row, col);
    }
  }
}

function isCellFixed(row, col) {
  // 检查格子是否是固定的（初始数字）
  return fixedCells[row][col];
}

function getCellElement(row, col) {
  return sudokuGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

// ==================== 格子选择 ====================
function selectCell(row, col) {
  if (!gameActive) return;
  
  // 清除之前的选中状态
  if (selectedCell !== null) {
    const [prevRow, prevCol] = selectedCell;
    const prevCell = getCellElement(prevRow, prevCol);
    if (prevCell) {
      prevCell.classList.remove('selected');
    }

// Developer: SinceraXY
    clearHighlights();
  }
  
  // 选中新格子
  selectedCell = [row, col];
  const cell = getCellElement(row, col);
  if (cell) {
    cell.classList.add('selected');
    highlightRelatedCells(row, col);
  }
}

function highlightRelatedCells(row, col) {
  // 高亮同行、同列、同宫格的格子
  for (let i = 0; i < 9; i++) {
    // 同行
    const rowCell = getCellElement(row, i);
    if (rowCell && i !== col) {
      rowCell.classList.add('highlighted');
    }
    
    // 同列
    const colCell = getCellElement(i, col);
    if (colCell && i !== row) {
      colCell.classList.add('highlighted');
    }
  }
  
  // 同宫格
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (r !== row || c !== col) {
        const cell = getCellElement(r, c);
        if (cell) {
          cell.classList.add('highlighted');
        }
      }
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.sudoku-cell.highlighted').forEach(cell => {
    cell.classList.remove('highlighted');
  });
}

function moveSelection(direction) {
  if (selectedCell === null) {
    selectCell(0, 0);
    return;
  }
  
  let [row, col] = selectedCell;
  
  switch (direction) {
    case 'ArrowUp':
      row = Math.max(0, row - 1);
      break;
    case 'ArrowDown':
      row = Math.min(8, row + 1);
      break;
    case 'ArrowLeft':
      col = Math.max(0, col - 1);
      break;
    case 'ArrowRight':
      col = Math.min(8, col + 1);
      break;
  }
  
  // 如果是固定格子，继续移动
  const cell = getCellElement(row, col);
  if (cell && cell.classList.contains('fixed')) {
    selectedCell = [row, col];
    moveSelection(direction);
  } else {
    selectCell(row, col);
  }
}

// ==================== 放置数字 ====================
function placeNumber(number) {
  if (!gameActive || selectedCell === null) return;
  
  const [row, col] = selectedCell;
  const cell = getCellElement(row, col);
  
  if (!cell || cell.classList.contains('fixed')) return;
  
  // 保存移动到历史
  const previousValue = board[row][col];
  moveHistory.push({ row, col, previousValue, newValue: number });
  
  // 更新游戏板
  board[row][col] = number;
  
  // 更新显示
  cell.textContent = number === 0 ? '' : number;
  
  // 清除之前的样式
  cell.classList.remove('error', 'correct');
  
  updateDisplay();
}

function isBoardComplete() {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0 || board[row][col] !== solution[row][col]) {
        return false;
      }
    }
  }
  return true;
}

// ==================== 提示功能 ====================
function giveHint() {
  if (!gameActive) return;
  
  // 检查是否还有提示次数
  if (hintsRemaining <= 0) {
    showMessage('❌ 提示次数已用完', 'error');
    return;
  }
  
  // 找到所有空格
  const emptyCells = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === 0) {
        emptyCells.push([row, col]);
      }
    }
  }
  
  if (emptyCells.length === 0) {
    showMessage('✅ 已经没有空格了', 'info');
    return;
  }
  
  // 随机选择一个空格
  const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  
  // 填入正确答案
  selectCell(row, col);
  placeNumber(solution[row][col]);
  
  // 减少提示次数
  hintsRemaining--;
  updateDisplay();
  
  // 短暂高亮
  const cell = getCellElement(row, col);
  if (cell) {
    cell.classList.add('correct');
    setTimeout(() => {
      cell.classList.remove('correct');
    }, 1000);
  }
  
  showMessage(`💡 提示已使用，剩余 ${hintsRemaining} 次`, 'info');
}

// ==================== 撤销功能 ====================
function undoMove() {
  if (!gameActive || moveHistory.length === 0) return;
  
  // 获取最后一步移动
  const lastMove = moveHistory.pop();
  const { row, col, previousValue } = lastMove;
  
  // 恢复之前的值
  board[row][col] = previousValue;
  
  // 更新显示
  const cell = getCellElement(row, col);
  if (cell) {
    cell.textContent = previousValue === 0 ? '' : previousValue;
    cell.classList.remove('error', 'correct');
  }
  
  // 选中该格子
  selectCell(row, col);
  
  updateDisplay();
}

// ==================== 检查功能 ====================
function checkBoard() {
  if (!gameActive) return;
  
  let isComplete = true;
  
  // 遍历所有格子，检查是否全部正确
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = board[row][col];
      
      // 如果有空格或者填入的数字不正确，标记为未完成
      if (value === 0 || value !== solution[row][col]) {
        isComplete = false;
        break;
      }
    }
    if (!isComplete) break;
  }
  
  // 显示检查结果
  if (isComplete) {
    // 全部正确，游戏胜利！
    showMessage('🎉 完全正确！数独完成，游戏胜利！', 'success');
    setTimeout(() => {
      endGame(true);
    }, 1000);
  } else {
    // 不全对，增加检查错误次数，但游戏继续
    checkCount++;
    updateDisplay();


    showMessage('❌ 还未全部正确，请继续努力！', 'error');
  }
}

// 显示提示消息
function showMessage(text, type = 'info') {
  // 移除已存在的消息
  const existingMsg = document.querySelector('.game-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  const message = document.createElement('div');
  message.className = `game-message ${type}`;
  message.textContent = text;
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    message.classList.remove('show');
    setTimeout(() => {
      message.remove();
    }, 300);
  }, 2500);
}
