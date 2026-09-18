// ==================== DOM元素 ====================
const messageEl = document.getElementById("msg");
const voiceStatusEl = document.getElementById("voice-status");
const hintsEl = document.getElementById("hints");
const browserWarningEl = document.getElementById("browser-warning");

// 统计元素
const attemptsEl = document.getElementById("attempts");
const bestScoreEl = document.getElementById("best-score");
const totalGamesEl = document.getElementById("total-games");

// 按钮元素
const newGameButton = document.getElementById("new-game-button");
const resetStatsButton = document.getElementById("reset-stats-button");
const instructionsToggle = document.getElementById("instructions-toggle");
const instructionsEl = document.getElementById("instructions");

// ==================== 游戏数据 ====================
// Project: GameHub
const game = {
  targetNumber: null,
  attempts: 0,
  isPlaying: false,
  recognition: null
};

const stats = {
  totalGames: 0,
  bestScore: null,
  gamesWon: 0
};

// ==================== 初始化 ====================
function init() {
  loadStats();
  updateStatsDisplay();
  checkBrowserSupport();
  setupEventListeners();
  showInitialHint();
}

/**
 * 显示初始提示
 */
function showInitialHint() {
  showHint("🎮", "欢迎！点击“开始新游戏”按钮开始挑战！");
}

/**
 * 检查浏览器支持
 */
function checkBrowserSupport() {
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!window.SpeechRecognition) {
    browserWarningEl.style.display = "block";
    newGameButton.disabled = true;
    setVoiceStatus("⚠️", "浏览器不支持语音识别", "idle");
    return false;
  }
  return true;
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
  newGameButton.addEventListener("click", startNewGame);
  resetStatsButton.addEventListener("click", resetStats);
  
  // 游戏说明切换
  instructionsToggle.addEventListener("click", () => {
    const isHidden = instructionsEl.style.display === "none";
    instructionsEl.style.display = isHidden ? "block" : "none";
    const icon = instructionsToggle.querySelector(".toggle-icon");
    icon.textContent = isHidden ? "➖" : "❓";
  });
}

// ==================== 游戏控制 ====================
/**
 * 开始新游戏
 */
function startNewGame() {
  if (!checkBrowserSupport()) return;
  
  // 停止之前的语音识别（如果有）
  stopRecognition();
  
  // 重置游戏状态
  game.targetNumber = getRandomNumber();
  game.attempts = 0;
  game.isPlaying = true;
/* Developer: SinceraXY - CUPB */
  
  // 更新界面
  updateAttemptsDisplay();
  clearMessage();
  setVoiceStatus("🎤", "正在监听...请用中文说数字", "listening");
  showHint("💡", "我已经想好了一个1到100之间的数字，开始猜吧！请用中文发音。");
  
  // 启动语音识别
  startRecognition();
  
  console.log(`目标数字: ${game.targetNumber}`);
}

/**
 * 生成随机数字
 */
function getRandomNumber() {
  return Math.floor(Math.random() * 100) + 1;
}

// ==================== 语音识别 ====================
/**
 * 启动语音识别
 */
function startRecognition() {
  if (game.recognition) {
    try {
      game.recognition.stop();
    } catch (e) {
      // 忽略错误
    }
  }
  
  game.recognition = new window.SpeechRecognition();
  game.recognition.lang = 'zh-CN'; // 设置为中文
  game.recognition.continuous = true; // 继续监听
  game.recognition.interimResults = false; // 不返回临时结果
  game.recognition.maxAlternatives = 3; // 返回多个可能结果
  
  game.recognition.addEventListener("result", onSpeechResult);
  game.recognition.addEventListener("end", onRecognitionEnd);
  game.recognition.addEventListener("error", onRecognitionError);
  game.recognition.addEventListener("start", onRecognitionStart);
  
  try {
    game.recognition.start();
    console.log("语音识别已启动");
  } catch (error) {
    console.error("语音识别启动失败:", error);
    setVoiceStatus("⚠️", "语音识别启动失败，请重试", "idle");
  }
}

/**
 * 语音识别开始
 */
function onRecognitionStart() {
  console.log("语音识别开始监听");
  setVoiceStatus("🎤", "正在监听...请用中文说数字", "listening");
}

/**
 * 停止语音识别
 */
function stopRecognition() {
  if (game.recognition) {
    try {
      game.recognition.stop();
      console.log("语音识别已停止");
    } catch (error) {
      console.error("停止语音识别错误:", error);
    }
    game.recognition = null;
  }
  setVoiceStatus("💤", "未开始 - 点击下方按钮开始游戏", "idle");
}

/**
 * 语音识别结果
 */
function onSpeechResult(event) {
  const transcript = event.results[event.results.length - 1][0].transcript;
  const message = transcript.trim();
  
  console.log(`识别结果: ${message}`);
  
  if (game.isPlaying) {
    displayMessage(message);
    checkNumber(message);
  }
}

/**
 * 语音识别结束
 */
function onRecognitionEnd() {
  if (game.isPlaying) {
    // 自动重启
    setTimeout(() => {
      if (game.isPlaying) {
        try {
          game.recognition.start();
        } catch (error) {
          console.error("重启语音识别失败:", error);
        }
      }
    }, 100);
  }
}

/**
 * 语音识别错误
 */
function onRecognitionError(event) {
  console.error("语音识别错误:", event.error);
  
  if (event.error === 'not-allowed' || event.error === 'permission-denied') {
    setVoiceStatus("⚠️", "请允许访问麦克风权限", "idle");
    showMessage("⚠️ 需要麦克风权限才能玩游戏，请在浏览器设置中允许。", "invalid");
    game.isPlaying = false;
  } else if (event.error === 'no-speech') {
    console.log("未检测到语音");
    // 不显示错误，继续监听
  } else if (event.error === 'aborted') {
    console.log("语音识别被中止");
  } else {
    console.error("其他语音错误:", event.error);
  }
}

// ==================== 游戏逻辑 ====================
/**
 * 检查数字
 */
function checkNumber(message) {
  // 提取数字
  const number = extractNumber(message);
  
  if (number === null) {
    showMessage(`未识别到有效数字，请说一个1到100之间的数字`, "invalid");
    return;
  }
  
  if (number < 1 || number > 100) {
    showMessage(`数字必须在00到100之间，你说的是 ${number}`, "invalid");
    return;
  }
  
  // 增加尝试次数
  game.attempts++;
  updateAttemptsDisplay();
  
  // 判断结果
  if (number === game.targetNumber) {
    onGameWin();
  } else if (number > game.targetNumber) {
    showMessage(`太大了！试试更小的数字`, "lower");
    showHint("🔻", `提示：目标数字小于 ${number}`);
  } else {
    showMessage(`太小了！试试更大的数字`, "higher");
    showHint("🔺", `提示：目标数字大于 ${number}`);
  }
}

/**
 * 从文本中提取数字（支持中文和阿拉伯数字）
 */
function extractNumber(text) {
  // 清理文本
  text = text.trim().toLowerCase();
  
  // 1. 尝试直接提取阿拉伯数字
  const arabicMatch = text.match(/\d+/);
  if (arabicMatch) {
    const num = parseInt(arabicMatch[0]);
    if (num >= 1 && num <= 100) {
      return num;
    }
  }
  
  // 2. 中文数字转换
  const chineseDigits = {
    '零': 0, '〇': 0,
    '一': 1, '壹': 1, '幺': 1,
    '二': 2, '贰': 2, '两': 2, '俩': 2,
    '三': 3, '叁': 3,
    '四': 4, '肆': 4,
    '五': 5, '伍': 5,
    '六': 6, '陆': 6,
    '七': 7, '柒': 7,
    '八': 8, '捌': 8,
    '九': 9, '玖': 9
  };
  
  // 3. 处理特殊情况
  // 十 = 10
  if (text === '十' || text === '拾') {
    return 10;
  }
  
  // 几十 (如：二十、五十)
  const tensMatch = text.match(/([一二三四五六七八九])十/);
  if (tensMatch) {
    const digit = chineseDigits[tensMatch[1]];
    return digit * 10;
  }
  
  // 十几 (如：十五、十八)
  const teenMatch = text.match(/十([一二三四五六七八九])/);
  if (teenMatch) {
    const digit = chineseDigits[teenMatch[1]];
    return 10 + digit;
  }
  
  // 几十几 (如：二十三、五十六)
  const fullMatch = text.match(/([一二三四五六七八九])十([一二三四五六七八九])/);
  if (fullMatch) {
    const tens = chineseDigits[fullMatch[1]];
    const ones = chineseDigits[fullMatch[2]];
    return tens * 10 + ones;
  }
  
  // 一百 = 100
  if (text.includes('百')) {
    return 100;
  }
  
  // 4. 单个中文数字（1-9）
  for (let char of text) {
    if (chineseDigits[char] !== undefined) {
      const num = chineseDigits[char];
      if (num >= 1 && num <= 9) {
        return num;
      }
    }
  }
  
  return null;
}

/**
 * 游戏胜利
 */
function onGameWin() {
  game.isPlaying = false;
  stopRecognition();
  
  // 更新统计
  stats.totalGames++;
  stats.gamesWon++;
  
  if (stats.bestScore === null || game.attempts < stats.bestScore) {
    stats.bestScore = game.attempts;
  }
  
  saveStats();
  updateStatsDisplay();
  
  // 显示胜利消息
  setVoiceStatus("🎉", "恭喜你猜对了！", "idle");
  
  let feedback = "";
  if (game.attempts === 1) {
    feedback = "🎆 难以置信！第一次就猜对了！";
  } else if (game.attempts <= 5) {
    feedback = "🚀 非常棒！你的直觉很准！";
  } else if (game.attempts <= 10) {
    feedback = "👍 不错！继续努力！";
  } else {
    feedback = "🎯 成功了！多练习会更好！";
  }
  
  messageEl.innerHTML = `
    <div class="message-text">你说的是：</div>
    <div class="number-box">${game.targetNumber}</div>
    <div class="feedback-text" style="color: var(--success-color); background: rgba(16, 185, 129, 0.1);">
      ${feedback}<br>
      使用了 ${game.attempts} 次尝试
    </div>
  `;
  
  showHint("🎮", "点击“开始新游戏”继续挑战！");
}

// ==================== UI更新 ====================
/**
 * 显示消息
 */
function displayMessage(text) {
  messageEl.innerHTML = `
    <div class="message-text">你说的是：</div>
    <div class="number-box">${text}</div>
  `;
}

/**
 * 显示反馈消息
 */
function showMessage(text, type = "") {
  const typeClass = type ? `feedback-${type}` : "";
  messageEl.innerHTML += `
    <div class="feedback-text ${typeClass}">${text}</div>
  `;
}

/**
 * 清空消息
 */
function clearMessage() {
  messageEl.innerHTML = "";
}

/**
 * 设置语音状态
 * @param {string} icon - 状态图标
 * @param {string} text - 状态文本
 * @param {string} state - 状态类型：idle 或 listening
 */
function setVoiceStatus(icon, text, state = "idle") {
  voiceStatusEl.innerHTML = `
    <span class="status-icon">${icon}</span>
    <span class="status-text">${text}</span>
  `;
  
  // 移除所有状态类
  voiceStatusEl.classList.remove("voice-status-idle", "voice-status-listening");
  
  // 添加新状态类
  if (state === "listening") {
    voiceStatusEl.classList.add("voice-status-listening");
  } else {
    voiceStatusEl.classList.add("voice-status-idle");
  }
}

/**
 * 显示提示
 */
function showHint(icon, text) {
  hintsEl.innerHTML = `
    <div class="hint-item">
      <span class="hint-icon">${icon}</span>

// Developer: SinceraXY from CUPB

      <span>${text}</span>
    </div>
  `;
}

/**
 * 更新尝试次数显示
 */
function updateAttemptsDisplay() {
  attemptsEl.textContent = game.attempts;
}

/**
 * 更新统计显示
 */
function updateStatsDisplay() {
  totalGamesEl.textContent = stats.totalGames;
  bestScoreEl.textContent = stats.bestScore !== null ? stats.bestScore : "-";
}

// ==================== 统计功能 ====================
/**
 * 重置统计
 */
function resetStats() {
  if (!confirm('确定要清空所有统计数据吗？')) return;
  
  // 重置统计数据
  stats.totalGames = 0;
  stats.bestScore = null;
  stats.gamesWon = 0;
  
  // 重置当前游戏次数
  game.attempts = 0;
  
  // 更新所有显示
  saveStats();
  updateStatsDisplay();
  updateAttemptsDisplay();
  
  showHint("✅", "统计数据已重置！");
}

// ==================== 本地存储 ====================
/**
 * 保存统计
 */
function saveStats() {
  try {
    localStorage.setItem('voiceGuessingStats', JSON.stringify(stats));
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

/**
 * 加载统计
 */
function loadStats() {
  try {
    const saved = localStorage.getItem('voiceGuessingStats');
    if (saved) {
      const data = JSON.parse(saved);
      stats.totalGames = data.totalGames || 0;
      stats.bestScore = data.bestScore || null;
      stats.gamesWon = data.gamesWon || 0;
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// ==================== 启动应用 ====================
init();
