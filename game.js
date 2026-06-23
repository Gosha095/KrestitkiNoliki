'use strict';

/* ════════════════════════════════════════
   STORAGE
════════════════════════════════════════ */
const Storage = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
};

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
const state = {
  difficulty: Storage.get('difficulty', 'medium'), // easy | medium | hard
  playerSymbol: 'X',
  aiSymbol: 'O',
  board: Array(9).fill(null),
  currentTurn: 'X',
  gameActive: false,
  sessionWins: 0,
  sessionLosses: 0,
  sessionDraws: 0,
  stats: Storage.get('stats', { wins: 0, losses: 0, draws: 0 }),
  history: Storage.get('history', []),
};

/* ════════════════════════════════════════
   WINNING COMBOS
════════════════════════════════════════ */
const WINS = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]          // diags
];

function checkWinner(board) {
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], combo: [a,b,c] };
  }
  if (board.every(Boolean)) return { winner: 'draw', combo: [] };
  return null;
}

/* ════════════════════════════════════════
   MINIMAX AI
════════════════════════════════════════ */
function minimax(board, isMax, alpha, beta, depth) {
  const res = checkWinner(board);
  if (res) {
    if (res.winner === 'draw') return 0;
    if (res.winner === state.aiSymbol) return 10 - depth;
    return depth - 10;
  }
  const sym = isMax ? state.aiSymbol : state.playerSymbol;
  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = sym;
    const score = minimax(board, !isMax, alpha, beta, depth + 1);
    board[i] = null;
    if (isMax) { best = Math.max(best, score); alpha = Math.max(alpha, score); }
    else        { best = Math.min(best, score); beta  = Math.min(beta, score); }
    if (beta <= alpha) break;
  }
  return best;
}

function getBestMove(board) {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = state.aiSymbol;
    const score = minimax(board, false, -Infinity, Infinity, 0);
    board[i] = null;
    if (score > best) { best = score; move = i; }
  }
  return move;
}

function getAIMove() {
  const empty = state.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
  if (empty.length === 0) return -1;

  if (state.difficulty === 'easy') {
    // 70% random
    if (Math.random() < .7) return empty[Math.floor(Math.random() * empty.length)];
    return getBestMove([...state.board]);
  }
  if (state.difficulty === 'medium') {
    // Block wins, set up wins, else random
    // Check if AI can win
    for (const i of empty) {
      const b = [...state.board]; b[i] = state.aiSymbol;
      if (checkWinner(b)?.winner === state.aiSymbol) return i;
    }
    // Block player
    for (const i of empty) {
      const b = [...state.board]; b[i] = state.playerSymbol;
      if (checkWinner(b)?.winner === state.playerSymbol) return i;
    }
    // 40% random else best
    if (Math.random() < .4) return empty[Math.floor(Math.random() * empty.length)];
    return getBestMove([...state.board]);
  }
  // hard: perfect minimax
  return getBestMove([...state.board]);
}

/* ════════════════════════════════════════
   DOM REFS
════════════════════════════════════════ */
const screens = {
  menu:   document.getElementById('screen-menu'),
  choose: document.getElementById('screen-choose'),
  game:   document.getElementById('screen-game'),
  stats:  document.getElementById('screen-stats'),
};
const cells = document.querySelectorAll('.cell');
const turnBanner    = document.getElementById('turn-banner');
const scorePlayer   = document.getElementById('score-player');
const scoreAI       = document.getElementById('score-ai');
const scoreDraw     = document.getElementById('score-draw');
const scorePlayerSym= document.getElementById('score-player-sym');
const scoreAISym    = document.getElementById('score-ai-sym');
const scorePlayerBlock = document.getElementById('score-player-block');
const scoreAIBlock     = document.getElementById('score-ai-block');
const resultOverlay = document.getElementById('result-overlay');
const resultEmoji   = document.getElementById('result-emoji');
const resultText    = document.getElementById('result-text');
const resultSub     = document.getElementById('result-sub');
const winLineEl     = document.getElementById('win-line-el');
const diffLabel     = document.getElementById('diff-label');
const statsPreview  = document.getElementById('stats-preview');
const statsGrid     = document.getElementById('stats-grid');
const historyList   = document.getElementById('history-list');

/* ════════════════════════════════════════
   SCREEN NAVIGATION
════════════════════════════════════════ */
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
}

/* ════════════════════════════════════════
   DIFFICULTY MODAL
════════════════════════════════════════ */
const diffModal = document.createElement('div');
diffModal.className = 'diff-modal-overlay';
diffModal.innerHTML = `
  <div class="diff-modal">
    <h3>Сложность</h3>
    <button class="diff-option" data-diff="easy">
      <span class="diff-title">Лёгкая</span>
      <span class="diff-desc">ИИ делает случайные ходы и изредка думает</span>
    </button>
    <button class="diff-option" data-diff="medium">
      <span class="diff-title">Средняя</span>
      <span class="diff-desc">ИИ блокирует угрозы, но иногда ошибается</span>
    </button>
    <button class="diff-option" data-diff="hard">
      <span class="diff-title">Сложная</span>
      <span class="diff-desc">ИИ играет оптимально — победить невозможно</span>
    </button>
    <button class="diff-close">Закрыть</button>
  </div>`;
document.body.appendChild(diffModal);

function updateDiffLabel() {
  const map = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' };
  diffLabel.textContent = map[state.difficulty];
  diffModal.querySelectorAll('.diff-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === state.difficulty);
  });
}
updateDiffLabel();

document.getElementById('btn-difficulty').addEventListener('click', () => {
  diffModal.classList.add('open');
});
diffModal.querySelector('.diff-close').addEventListener('click', () => {
  diffModal.classList.remove('open');
});
diffModal.querySelectorAll('.diff-option').forEach(btn => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.diff;
    Storage.set('difficulty', state.difficulty);
    updateDiffLabel();
    diffModal.classList.remove('open');
  });
});
diffModal.addEventListener('click', e => {
  if (e.target === diffModal) diffModal.classList.remove('open');
});

/* ════════════════════════════════════════
   STATS PREVIEW (menu)
════════════════════════════════════════ */
function updateStatsPreview() {
  const s = state.stats;
  const total = s.wins + s.losses + s.draws;
  if (!total) {
    statsPreview.textContent = 'Пока нет сыгранных партий';
    return;
  }
  const winRate = Math.round((s.wins / total) * 100);
  statsPreview.innerHTML = `
    Всего игр: <strong>${total}</strong> &nbsp;|&nbsp;
    Победы: <strong style="color:#5cde8a">${s.wins}</strong> &nbsp;|&nbsp;
    Процент побед: <strong>${winRate}%</strong>
  `;
}
updateStatsPreview();

/* ════════════════════════════════════════
   WIN LINE COORDINATES
════════════════════════════════════════ */
const lineCoordsMap = {
  '0,1,2': [16, 50, 284, 50],
  '3,4,5': [16, 150, 284, 150],
  '6,7,8': [16, 250, 284, 250],
  '0,3,6': [50, 16, 50, 284],
  '1,4,7': [150, 16, 150, 284],
  '2,5,8': [250, 16, 250, 284],
  '0,4,8': [16, 16, 284, 284],
  '2,4,6': [284, 16, 16, 284],
};
function drawWinLine(combo) {
  const key = combo.join(',');
  const [x1, y1, x2, y2] = lineCoordsMap[key] || [0,0,0,0];
  winLineEl.setAttribute('x1', x1);
  winLineEl.setAttribute('y1', y1);
  winLineEl.setAttribute('x2', x2);
  winLineEl.setAttribute('y2', y2);
  winLineEl.classList.add('draw-line');
}
function clearWinLine() {
  winLineEl.classList.remove('draw-line');
  winLineEl.setAttribute('x1', 0); winLineEl.setAttribute('y1', 0);
  winLineEl.setAttribute('x2', 0); winLineEl.setAttribute('y2', 0);
}

/* ════════════════════════════════════════
   BOARD RENDER
════════════════════════════════════════ */
function renderBoard(animate = -1) {
  cells.forEach((cell, i) => {
    const val = state.board[i];
    cell.textContent = val || '';
    cell.className = 'cell';
    if (val === 'X') cell.classList.add('x-cell', 'taken');
    if (val === 'O') cell.classList.add('o-cell', 'taken');
    if (i === animate) cell.classList.add('pop-in');
  });
}

/* ════════════════════════════════════════
   SCORE UPDATE
════════════════════════════════════════ */
function updateScore() {
  scorePlayer.textContent = state.sessionWins;
  scoreAI.textContent     = state.sessionLosses;
  scoreDraw.textContent   = state.sessionDraws;
  scorePlayerSym.textContent = state.playerSymbol === 'X' ? '✕' : '○';
  scoreAISym.textContent     = state.aiSymbol     === 'X' ? '✕' : '○';
  scorePlayerSym.style.color = state.playerSymbol === 'X' ? 'var(--x-color)' : 'var(--o-color)';
  scoreAISym.style.color     = state.aiSymbol     === 'X' ? 'var(--x-color)' : 'var(--o-color)';
}

/* ════════════════════════════════════════
   TURN INDICATOR
════════════════════════════════════════ */
function updateTurnBanner() {
  const isPlayer = state.currentTurn === state.playerSymbol;
  turnBanner.textContent = isPlayer ? 'Ваш ход' : 'ИИ думает...';
  scorePlayerBlock.classList.toggle('active-turn', isPlayer);
  scoreAIBlock.classList.toggle('active-turn', !isPlayer);
}

/* ════════════════════════════════════════
   SHOW RESULT
════════════════════════════════════════ */
function showResult(winner, combo) {
  const winTexts = [
    'Вы победили!', 'Отличная игра!', 'Молодец!', 'Непобедимы!'
  ];
  const loseTexts = [
    'ИИ победил!', 'Проиграли...', 'В следующий раз!', 'ИИ слишком силён!'
  ];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  if (winner === state.playerSymbol) {
    resultEmoji.textContent = '🎉';
    resultText.textContent = pick(winTexts);
    resultSub.textContent = 'Так держать! Попробуйте сложнее?';
    state.sessionWins++;
    state.stats.wins++;
    addHistory('win');
  } else if (winner === 'draw') {
    resultEmoji.textContent = '🤝';
    resultText.textContent = 'Ничья!';
    resultSub.textContent = 'Никто не победил. Попробуйте ещё раз!';
    state.sessionDraws++;
    state.stats.draws++;
    addHistory('draw');
  } else {
    resultEmoji.textContent = '🤖';
    resultText.textContent = pick(loseTexts);
    resultSub.textContent = 'ИИ доволен. Попробуйте снова!';
    state.sessionLosses++;
    state.stats.losses++;
    addHistory('loss');
  }
  Storage.set('stats', state.stats);
  Storage.set('history', state.history);
  updateScore();
  updateStatsPreview();

  if (combo.length) drawWinLine(combo);

  setTimeout(() => resultOverlay.classList.add('visible'), 500);
}

/* ════════════════════════════════════════
   HISTORY
════════════════════════════════════════ */
function addHistory(result) {
  const diffMap = { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' };
  state.history.unshift({
    result,
    sym: state.playerSymbol,
    diff: diffMap[state.difficulty],
    date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
  });
  if (state.history.length > 30) state.history.pop();
}

/* ════════════════════════════════════════
   PLAYER MOVE
════════════════════════════════════════ */
function playerMove(idx) {
  if (!state.gameActive) return;
  if (state.currentTurn !== state.playerSymbol) return;
  if (state.board[idx]) return;

  state.board[idx] = state.playerSymbol;
  renderBoard(idx);

  const result = checkWinner(state.board);
  if (result) { state.gameActive = false; showResult(result.winner, result.combo); return; }

  state.currentTurn = state.aiSymbol;
  updateTurnBanner();
  setTimeout(aiMove, 500 + Math.random() * 400);
}

/* ════════════════════════════════════════
   AI MOVE
════════════════════════════════════════ */
function aiMove() {
  if (!state.gameActive) return;
  const idx = getAIMove();
  if (idx === -1) return;

  state.board[idx] = state.aiSymbol;
  renderBoard(idx);

  const result = checkWinner(state.board);
  if (result) { state.gameActive = false; showResult(result.winner, result.combo); return; }

  state.currentTurn = state.playerSymbol;
  updateTurnBanner();
}

/* ════════════════════════════════════════
   START GAME
════════════════════════════════════════ */
function startGame(symbol) {
  state.playerSymbol = symbol;
  state.aiSymbol     = symbol === 'X' ? 'O' : 'X';
  state.board        = Array(9).fill(null);
  state.currentTurn  = 'X';
  state.gameActive   = true;

  clearWinLine();
  resultOverlay.classList.remove('visible');
  renderBoard();
  updateScore();
  updateTurnBanner();
  showScreen('game');

  // If AI goes first
  if (state.aiSymbol === 'X') {
    setTimeout(aiMove, 600);
  }
}

/* ════════════════════════════════════════
   RESTART ROUND (same symbols)
════════════════════════════════════════ */
function restartRound() {
  state.board       = Array(9).fill(null);
  state.currentTurn = 'X';
  state.gameActive  = true;
  clearWinLine();
  resultOverlay.classList.remove('visible');
  renderBoard();
  updateTurnBanner();

  if (state.aiSymbol === 'X') {
    setTimeout(aiMove, 600);
  }
}

/* ════════════════════════════════════════
   STATS SCREEN RENDER
════════════════════════════════════════ */
function renderStats() {
  const s = state.stats;
  const total = s.wins + s.losses + s.draws;
  statsGrid.innerHTML = `
    <div class="stat-card win">
      <span class="stat-val">${s.wins}</span>
      <span class="stat-label">Победы</span>
    </div>
    <div class="stat-card loss">
      <span class="stat-val">${s.losses}</span>
      <span class="stat-label">Поражения</span>
    </div>
    <div class="stat-card draw">
      <span class="stat-val">${s.draws}</span>
      <span class="stat-label">Ничьи</span>
    </div>
    <div class="stat-card">
      <span class="stat-val">${total ? Math.round(s.wins/total*100) : 0}%</span>
      <span class="stat-label">Процент побед</span>
    </div>
  `;

  if (!state.history.length) {
    historyList.innerHTML = '<p class="no-history">Нет истории игр</p>';
  } else {
    const map = { win: '🏆 Победа', loss: '💀 Поражение', draw: '🤝 Ничья' };
    historyList.innerHTML = state.history.map(h => `
      <div class="history-item">
        <div>
          <span class="hist-result ${h.result}">${map[h.result]}</span>
          <span style="color:var(--text-dim);font-size:.75rem;margin-left:8px">
            ${h.sym === 'X' ? '✕' : '○'} · ${h.diff}
          </span>
        </div>
        <span class="hist-date">${h.date}</span>
      </div>`).join('');
  }
}

/* ════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════ */
document.getElementById('btn-play').addEventListener('click', () => showScreen('choose'));
document.getElementById('btn-stats').addEventListener('click', () => { renderStats(); showScreen('stats'); });

document.getElementById('back-from-choose').addEventListener('click', () => showScreen('menu'));
document.getElementById('back-from-game').addEventListener('click', () => {
  state.gameActive = false;
  showScreen('menu');
  updateStatsPreview();
});
document.getElementById('back-from-stats').addEventListener('click', () => showScreen('menu'));

document.getElementById('pick-x').addEventListener('click', () => startGame('X'));
document.getElementById('pick-o').addEventListener('click', () => startGame('O'));

cells.forEach(cell => {
  cell.addEventListener('click', () => playerMove(+cell.dataset.i));
});

document.getElementById('btn-restart').addEventListener('click', restartRound);
document.getElementById('btn-menu-from-game').addEventListener('click', () => {
  state.gameActive = false;
  showScreen('menu');
  updateStatsPreview();
});
document.getElementById('btn-next-round').addEventListener('click', restartRound);
document.getElementById('btn-to-menu').addEventListener('click', () => {
  state.gameActive = false;
  resultOverlay.classList.remove('visible');
  showScreen('menu');
  updateStatsPreview();
});

document.getElementById('btn-clear-stats').addEventListener('click', () => {
  if (!confirm('Сбросить всю статистику?')) return;
  state.stats   = { wins: 0, losses: 0, draws: 0 };
  state.history = [];
  Storage.set('stats', state.stats);
  Storage.set('history', state.history);
  renderStats();
  updateStatsPreview();
});
