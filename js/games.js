/* ============================================================
 * 游戏厅 (js/games.js)
 * ------------------------------------------------------------
 * 41 款小游戏来自 SinceraXY/GameHub(Apache-2.0)，改动见 games/README.md。
 * 数据与 games/ 目录一一对应；只负责渲染分类胶囊和卡片网格。
 * ============================================================ */
(function () {
  'use strict';
  var CATS = [{"key":"Puzzle","label":"益智解谜","icon":"fa-puzzle-piece"},{"key":"Action","label":"动作反应","icon":"fa-bolt"},{"key":"Arcade","label":"经典街机","icon":"fa-crown"},{"key":"Board","label":"棋牌策略","icon":"fa-chess"},{"key":"Memory","label":"记忆训练","icon":"fa-brain"},{"key":"Typing","label":"打字练习","icon":"fa-keyboard"},{"key":"Casual","label":"休闲娱乐","icon":"fa-smile"}];
  var GAMES = {"Puzzle":[{"name":"2048","path":"games/Puzzle/2048/index.html","icon":"fas fa-th","desc":"经典数字合并益智游戏"},{"name":"Jigsaw Puzzle","path":"games/Puzzle/Jigsaw-Puzzle/index.html","icon":"fas fa-puzzle-piece","desc":"趣味拼图挑战"},{"name":"Klotski","path":"games/Puzzle/Klotski/index.html","icon":"fas fa-chess-board","desc":"华容道滑块解谜"},{"name":"Maze Escape","path":"games/Puzzle/Maze-Escape/index.html","icon":"fas fa-route","desc":"迷宫逃脱冒险"},{"name":"Minesweeper","path":"games/Puzzle/Minesweeper/index.html","icon":"fas fa-bomb","desc":"经典扫雷游戏"},{"name":"Spot Difference","path":"games/Puzzle/Spot-Difference/index.html","icon":"fas fa-search","desc":"找不同挑战"},{"name":"Sudoku","path":"games/Puzzle/Sudoku/index.html","icon":"fas fa-table-cells","desc":"数独逻辑游戏"},{"name":"Tilting Maze","path":"games/Puzzle/Tilting-Maze/index.html","icon":"fas fa-compass","desc":"重力迷宫"}],"Action":[{"name":"Breakout","path":"games/Action/Breakout/index.html","icon":"fas fa-cube","desc":"打砖块游戏"},{"name":"Crossy Road","path":"games/Action/Crossy-Road/index.html","icon":"fas fa-road","desc":"过马路挑战"},{"name":"Emoji Catcher","path":"games/Action/Emoji-Catcher/index.html","icon":"fas fa-smile","desc":"表情符号捕捉"},{"name":"Flappy Bird","path":"games/Action/Flappy-Bird/index.html","icon":"fas fa-dove","desc":"飞翔的小鸟"},{"name":"Fruit Slicer","path":"games/Action/Fruit-Slicer/index.html","icon":"fas fa-lemon","desc":"水果切切乐"},{"name":"Insect Catch","path":"games/Action/Insect-Catch/index.html","icon":"fas fa-bug","desc":"昆虫捕捉"},{"name":"Piano Tiles","path":"games/Action/Piano-Tiles/index.html","icon":"fas fa-music","desc":"别踩白块"},{"name":"Ping Pong","path":"games/Action/Ping-Pong/index.html","icon":"fas fa-table-tennis-paddle-ball","desc":"乒乓球对战"},{"name":"Shape Clicker","path":"games/Action/Shape-Clicker/index.html","icon":"fas fa-shapes","desc":"形状点击"},{"name":"Whack A Mole","path":"games/Action/Whack-A-Mole/index.html","icon":"fas fa-hammer","desc":"打地鼠游戏"}],"Arcade":[{"name":"Bubble Shooter","path":"games/Arcade/Bubble-Shooter/index.html","icon":"fas fa-circle","desc":"泡泡龙射击"},{"name":"Candy Crush","path":"games/Arcade/Candy-Crush/index.html","icon":"fas fa-candy-cane","desc":"糖果消消乐"},{"name":"Jump Game","path":"games/Arcade/Jump-Game/index.html","icon":"fas fa-person-running","desc":"跳跃冒险"},{"name":"Pac-Man","path":"games/Arcade/Pac-Man/index.html","icon":"fas fa-ghost","desc":"经典吃豆人"},{"name":"Snake","path":"games/Arcade/Snake/index.html","icon":"fas fa-worm","desc":"贪吃蛇"},{"name":"Space Invaders","path":"games/Arcade/Space-Invaders/index.html","icon":"fas fa-space-shuttle","desc":"太空入侵者"},{"name":"Tetris","path":"games/Arcade/Tetris/index.html","icon":"fas fa-square","desc":"俄罗斯方块"},{"name":"Tower Blocks","path":"games/Arcade/Tower-Blocks/index.html","icon":"fas fa-layer-group","desc":"叠叠乐"}],"Board":[{"name":"Gomoku","path":"games/Board/Gomoku/index.html","icon":"fas fa-circle-dot","desc":"五子棋对战"},{"name":"Rock Paper Scissors","path":"games/Board/Rock-Paper-Scissors/index.html","icon":"fas fa-hand-scissors","desc":"石头剪刀布"},{"name":"Tic Tac Toe","path":"games/Board/Tic-Tac-Toe/index.html","icon":"fas fa-hashtag","desc":"井字棋"}],"Memory":[{"name":"Color Match","path":"games/Memory/Color-Match/index.html","icon":"fas fa-palette","desc":"颜色匹配记忆"},{"name":"Match Pairs","path":"games/Memory/Match-Pairs/index.html","icon":"fas fa-clone","desc":"配对记忆"},{"name":"Memory Card","path":"games/Memory/Memory-Card/index.html","icon":"fas fa-id-card","desc":"记忆卡片翻牌"},{"name":"Simon Says","path":"games/Memory/Simon-Says/index.html","icon":"fas fa-circle-notch","desc":"西蒙说记忆"}],"Typing":[{"name":"Hangman","path":"games/Typing/Hangman/index.html","icon":"fas fa-spell-check","desc":"猜单词游戏"},{"name":"Speed Typing","path":"games/Typing/Speed-Typing/index.html","icon":"fas fa-keyboard","desc":"速度打字练习"},{"name":"Type Master","path":"games/Typing/Type-Master/index.html","icon":"fas fa-font","desc":"打字大师"},{"name":"Typing Speed Challenge","path":"games/Typing/Typing-Speed-Challenge/index.html","icon":"fas fa-stopwatch","desc":"打字速度挑战"}],"Casual":[{"name":"Dice Roll Simulator","path":"games/Casual/Dice-Roll-Simulator/index.html","icon":"fas fa-dice","desc":"骰子模拟器"},{"name":"Quiz","path":"games/Casual/Quiz/index.html","icon":"fas fa-question-circle","desc":"知识问答"},{"name":"Speak Number Guessing","path":"games/Casual/Speak-Number-Guessing/index.html","icon":"fas fa-microphone","desc":"语音猜数字"},{"name":"Type Number Guessing","path":"games/Casual/Type-Number-Guessing/index.html","icon":"fas fa-calculator","desc":"打字猜数字"}]};

  function byId(id) { return document.getElementById(id); }
  function total() { return CATS.reduce(function (n, c) { return n + (GAMES[c.key] || []).length; }, 0); }

  function chip(cat, count, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'hub-chip' + (on ? ' is-on' : '');
    b.setAttribute('data-cat', cat.key);
    b.innerHTML = '<i class="fas ' + cat.icon + '"></i><span>' + cat.label + '</span><span class="hub-count">' + count + '</span>';
    return b;
  }

  function card(g) {
    var a = document.createElement('a');
    a.className = 'hub-card';
    a.href = g.path;
    a.innerHTML = '<span class="hub-ico"><i class="' + g.icon + '"></i></span>' +
      '<span class="hub-go"><i class="fas fa-arrow-up-right-from-square"></i></span>' +
      '<span class="hub-name"></span><span class="hub-desc"></span>';
    a.querySelector('.hub-name').textContent = g.name;
    a.querySelector('.hub-desc').textContent = g.desc || '';
    return a;
  }

  function render(catKey) {
    var grid = byId('gamesGrid');
    if (!grid) return;
    var list = catKey === 'all' ? CATS.reduce(function (a, c) { return a.concat(GAMES[c.key] || []); }, []) : (GAMES[catKey] || []);
    grid.innerHTML = '';
    list.forEach(function (g) { grid.appendChild(card(g)); });
  }

  function init() {
    var bar = byId('gamesFilter');
    if (!bar) return;
    bar.appendChild(chip({ key: 'all', label: '全部', icon: 'fa-border-all' }, total(), true));
    CATS.forEach(function (c) { bar.appendChild(chip(c, (GAMES[c.key] || []).length, false)); });
    bar.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.hub-chip') : null;
      if (!b) return;
      Array.prototype.forEach.call(bar.querySelectorAll('.hub-chip'), function (x) { x.classList.toggle('is-on', x === b); });
      render(b.getAttribute('data-cat'));
    });
    render('all');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
