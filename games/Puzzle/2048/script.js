// ==================== 等待DOM加载完成 ====================
document.addEventListener("DOMContentLoaded", () => {
  // ==================== DOM元素 ====================
  const gridDisplay = document.querySelector(".grid");
  const scoreDisplay = document.getElementById("score");
  const highScoreDisplay = document.getElementById("high-score");
  const resultDisplay = document.getElementById("result");
  const newGameBtn = document.getElementById("new-game-btn");
  const helpBtn = document.getElementById("help-btn");
  const closeHelpBtn = document.getElementById("close-help");
  const startBtn = document.getElementById("start-btn");
  const helpModal = document.getElementById("help-modal");
  
  // 移动端控制按钮
  const upBtn = document.querySelector(".up-btn");
  const downBtn = document.querySelector(".down-btn");
  const leftBtn = document.querySelector(".left-btn");
  const rightBtn = document.querySelector(".right-btn");
  
  // ==================== 游戏变量 ====================
  let squares = [];           // 存储所有格子元素
  const width = 4;           // 棋盘宽度（4x4）
  let score = 0;             // 当前分数
  let highScore = 0;         // 最高分
  let isGameOver = false;    // 游戏是否结束
  
  // ==================== 最高分系统 ====================
  // 从本地存储加载最高分
  function loadHighScore() {
    const saved = localStorage.getItem('game2048_highscore');
    highScore = saved ? parseInt(saved) : 0;
    highScoreDisplay.textContent = highScore;
  }
  
  // 更新最高分
  function updateHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('game2048_highscore', highScore);
      highScoreDisplay.textContent = highScore;
    }
  }
  
  // 初始化时加载最高分
  loadHighScore();

  // ==================== 创建游戏棋盘 ====================
  function createBoard() {
    // 清空现有棋盘
    gridDisplay.innerHTML = '';
    squares = [];
    
    // 创建16个格子（4x4）
    for (let i = 0; i < width * width; i++) {
      const square = document.createElement("div");
      square.innerHTML = "";
      square.dataset.value = "0";
      gridDisplay.appendChild(square);
      squares.push(square);
    }
    
    // 生成两个初始数字
    generate();
    generate();
  }
  
  // 初始化游戏
  createBoard();

  // ==================== 生成新数字 ====================
  function generate() {
    // 查找所有空格子
    const emptySquares = squares.filter(square => square.innerHTML === "" || square.innerHTML === "0");
    
    if (emptySquares.length === 0) {
      checkForGameOver();
      return;
    }
// Author: SinceraXY
    
    // 随机选择一个空格子
    const randomSquare = emptySquares[Math.floor(Math.random() * emptySquares.length)];
    
    // 90%概率生成2，10%概率生成4
    const newValue = Math.random() < 0.9 ? 2 : 4;
    randomSquare.innerHTML = newValue;
    randomSquare.dataset.value = newValue;
    
    checkForGameOver();
  }

  // ==================== 向右移动 ====================
  function moveRight() {
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) {
        // 获取一行的四个值
        let row = [
          parseInt(squares[i].innerHTML) || 0,
          parseInt(squares[i + 1].innerHTML) || 0,
          parseInt(squares[i + 2].innerHTML) || 0,
          parseInt(squares[i + 3].innerHTML) || 0,
        ];

        // 过滤掉0，只保留数字
        let filteredRow = row.filter((num) => num);
        // 计算需要填充的0的数量
        let missing = 4 - filteredRow.length;
        let zeros = Array(missing).fill(0);
        // 0放在左边，数字放在右边
        let newRow = zeros.concat(filteredRow);

        // 更新格子内容
        squares[i].innerHTML = newRow[0] || "";
        squares[i].dataset.value = newRow[0] || "0";
        squares[i + 1].innerHTML = newRow[1] || "";
        squares[i + 1].dataset.value = newRow[1] || "0";
        squares[i + 2].innerHTML = newRow[2] || "";
        squares[i + 2].dataset.value = newRow[2] || "0";
        squares[i + 3].innerHTML = newRow[3] || "";
        squares[i + 3].dataset.value = newRow[3] || "0";
      }
    }
  }

  // ==================== 向左移动 ====================
  function moveLeft() {
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) {
        // 获取一行的四个值
        let row = [

// GitHub: https://github.com/SinceraXY/GameHub

          parseInt(squares[i].innerHTML) || 0,
          parseInt(squares[i + 1].innerHTML) || 0,
          parseInt(squares[i + 2].innerHTML) || 0,
          parseInt(squares[i + 3].innerHTML) || 0,
        ];

        // 过滤掉0，只保留数字
        let filteredRow = row.filter((num) => num);
        // 计算需要填充的0的数量
        let missing = 4 - filteredRow.length;
        let zeros = Array(missing).fill(0);
        // 数字放在左边，0放在右边
        let newRow = filteredRow.concat(zeros);

        // 更新格子内容
        squares[i].innerHTML = newRow[0] || "";
        squares[i].dataset.value = newRow[0] || "0";
        squares[i + 1].innerHTML = newRow[1] || "";
        squares[i + 1].dataset.value = newRow[1] || "0";
        squares[i + 2].innerHTML = newRow[2] || "";
        squares[i + 2].dataset.value = newRow[2] || "0";
        squares[i + 3].innerHTML = newRow[3] || "";
        squares[i + 3].dataset.value = newRow[3] || "0";
      }
    }
  }

  // ==================== 向上移动 ====================
  function moveUp() {
    for (let i = 0; i < 4; i++) {
      // 获取一列的四个值
      let column = [
        parseInt(squares[i].innerHTML) || 0,
        parseInt(squares[i + width].innerHTML) || 0,
        parseInt(squares[i + width * 2].innerHTML) || 0,
        parseInt(squares[i + width * 3].innerHTML) || 0,
      ];

      // 过滤掉0，只保留数字
      let filteredColumn = column.filter((num) => num);
      // 计算需要填充的0的数量
      let missing = 4 - filteredColumn.length;
      let zeros = Array(missing).fill(0);
      // 数字放在上边，0放在下边
      let newColumn = filteredColumn.concat(zeros);

      // 更新格子内容
      squares[i].innerHTML = newColumn[0] || "";
      squares[i].dataset.value = newColumn[0] || "0";
      squares[i + width].innerHTML = newColumn[1] || "";
      squares[i + width].dataset.value = newColumn[1] || "0";
      squares[i + width * 2].innerHTML = newColumn[2] || "";
      squares[i + width * 2].dataset.value = newColumn[2] || "0";
      squares[i + width * 3].innerHTML = newColumn[3] || "";
      squares[i + width * 3].dataset.value = newColumn[3] || "0";
    }
  }

  // ==================== 向下移动 ====================
  function moveDown() {
    for (let i = 0; i < 4; i++) {
      // 获取一列的四个值
      let column = [
        parseInt(squares[i].innerHTML) || 0,
        parseInt(squares[i + width].innerHTML) || 0,
        parseInt(squares[i + width * 2].innerHTML) || 0,
        parseInt(squares[i + width * 3].innerHTML) || 0,
      ];

      // 过滤掉0，只保留数字
      let filteredColumn = column.filter((num) => num);
      // 计算需要填充的0的数量
      let missing = 4 - filteredColumn.length;
      let zeros = Array(missing).fill(0);
      // 0放在上边，数字放在下边
      let newColumn = zeros.concat(filteredColumn);

      // 更新格子内容
      squares[i].innerHTML = newColumn[0] || "";
      squares[i].dataset.value = newColumn[0] || "0";
      squares[i + width].innerHTML = newColumn[1] || "";
      squares[i + width].dataset.value = newColumn[1] || "0";
      squares[i + width * 2].innerHTML = newColumn[2] || "";
      squares[i + width * 2].dataset.value = newColumn[2] || "0";
      squares[i + width * 3].innerHTML = newColumn[3] || "";
      squares[i + width * 3].dataset.value = newColumn[3] || "0";
    }
  }

  // ==================== 合并行 ====================
  function combineRow() {
    for (let i = 0; i < 15; i++) {
      // 检查相邻的两个格子是否相同且不为空
      if (squares[i].innerHTML && squares[i].innerHTML === squares[i + 1].innerHTML) {
        let combinedTotal =
          parseInt(squares[i].innerHTML) + parseInt(squares[i + 1].innerHTML);
        squares[i].innerHTML = combinedTotal;
        squares[i].dataset.value = combinedTotal;
        squares[i + 1].innerHTML = "";
        squares[i + 1].dataset.value = "0";
        score += combinedTotal;
        scoreDisplay.textContent = score;
        updateHighScore(); // 更新最高分
      }
    }
    checkForWin();
  }

  // ==================== 合并列 ====================
  function combineColumn() {
    for (let i = 0; i < 12; i++) {
      // 检查相邻的两个格子是否相同且不为空
      if (squares[i].innerHTML && squares[i].innerHTML === squares[i + width].innerHTML) {
        let combinedTotal =
          parseInt(squares[i].innerHTML) +
          parseInt(squares[i + width].innerHTML);
        squares[i].innerHTML = combinedTotal;
        squares[i].dataset.value = combinedTotal;
        squares[i + width].innerHTML = "";
        squares[i + width].dataset.value = "0";
        score += combinedTotal;
        scoreDisplay.textContent = score;
        updateHighScore(); // 更新最高分
      }
    }
    checkForWin();
  }

  // ==================== 键盘控制 ====================
  function control(e) {
    if (isGameOver) return; // 游戏结束后禁止操作
    
    if (e.keyCode === 37) {
      e.preventDefault();
      keyLeft();
    } else if (e.keyCode === 38) {
      e.preventDefault();
      keyUp();
    } else if (e.keyCode === 39) {
      e.preventDefault();
      keyRight();
    } else if (e.keyCode === 40) {
      e.preventDefault();
      keyDown();
    }
  }
  document.addEventListener("keydown", control);

  // 向右
  function keyRight() {
    moveRight();
    combineRow();
    moveRight();
    generate();
  }

  // 向左
/* Project: GameHub */
  function keyLeft() {
    moveLeft();
    combineRow();
    moveLeft();
    generate();
  }

  // 向上
  function keyUp() {
    moveUp();
    combineColumn();
    moveUp();
    generate();
  }

  // 向下
  function keyDown() {
    moveDown();
    combineColumn();
    moveDown();
    generate();
  }

  // ==================== 检查胜利 ====================
  function checkForWin() {
    for (let i = 0; i < squares.length; i++) {
      if (parseInt(squares[i].innerHTML) === 2048) {
        resultDisplay.innerHTML = "🎉 恭喜你！达到 <strong>2048</strong>！";
        isGameOver = true;
        return;
      }
    }
  }

  // ==================== 检查失败 ====================
  function checkForGameOver() {
    // 检查是否还有空格
    const hasEmpty = squares.some(square => !square.innerHTML || square.innerHTML === "0");
    if (hasEmpty) return;
    
    // 检查是否还能合并（横向和纵向）
    for (let i = 0; i < squares.length; i++) {
      const value = squares[i].innerHTML;
      // 检查右边
      if (i % 4 !== 3 && value === squares[i + 1].innerHTML) return;
      // 检查下边
      if (i < 12 && value === squares[i + 4].innerHTML) return;
    }
    
    // 游戏结束
    resultDisplay.innerHTML = "😔 游戏结束！点击重新开始";
    isGameOver = true;
  }

  // ==================== 重新开始游戏 ====================
  function newGame() {
    score = 0;
    scoreDisplay.textContent = score;
    isGameOver = false;
    resultDisplay.innerHTML = "合并相同数字，挑战 <strong>2048</strong> 方块！";
    createBoard();
  }
  
  // ==================== 帮助弹窗控制 ====================
  function showHelp() {
    helpModal.classList.add('show');
  }
  
  function hideHelp() {
    helpModal.classList.remove('show');
  }
  
  // ==================== 事件监听 ====================
  // 重新开始按钮
  newGameBtn.addEventListener('click', newGame);
  
  // 帮助按钮
  helpBtn.addEventListener('click', showHelp);
  closeHelpBtn.addEventListener('click', hideHelp);
  startBtn.addEventListener('click', hideHelp);
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) hideHelp();
  });
  
  // 移动端控制按钮
  if (upBtn) upBtn.addEventListener('click', () => !isGameOver && keyUp());
  if (downBtn) downBtn.addEventListener('click', () => !isGameOver && keyDown());
  if (leftBtn) leftBtn.addEventListener('click', () => !isGameOver && keyLeft());
  if (rightBtn) rightBtn.addEventListener('click', () => !isGameOver && keyRight());
});
