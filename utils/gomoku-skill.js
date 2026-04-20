/**
 * 技能五子棋游戏逻辑 - 真技能五子棋
 */

const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;  // 玩家（侠客）
const WHITE = 2;  // AI（魔头）

// 技能定义
const SKILLS = {
  1: { name: '时光倒流', cost: 30, desc: '悔棋: 黑白双方各回退一步' },
  2: { name: '力拔山兮', cost: 50, desc: '炸毁十字5格(中心+上下左右)' },
  3: { name: '飞沙走石', cost: 70, desc: '移动对方一个棋子到别处' },
  4: { name: '静如止水', cost: 100, desc: '暂停对方一个回合' },
  5: { name: '东山再起', cost: 200, desc: '重开棋局,清空所有棋子' }
};

class SkillGomoku {
  constructor() {
    this.board = this.initBoard();
    this.turn = BLACK;
    this.mp = { [BLACK]: 0, [WHITE]: 0 }; // 开局内力为0
    this.gameOver = false;
    this.winner = null;
    this.moveCount = 0;
    this.currentSkill = null;
    this.extraTurns = 0;
    this.skipNextTurn = false; // 技能4: 跳过下一回合
    this.moveHistory = []; // 历史记录: [{row, col, player, mpBefore}]
    this.selectedPiece = null; // 技能3: 已选择的棋子
    this.transpositionTable = new Map(); // 搜索置换表
    this.historyHeuristic = new Map(); // 历史启发分
    this.searchDeadline = 0;
    this.searchNodeBudget = 0;
    this.searchNodes = 0;
    this.searchStopped = false;
    this.killerMoves = new Map(); // depth|player -> [best, second]
    this.vctTranspositionLayers = new Map(); // VCT 分层置换表
    this.killDeadline = 0;
    this.killNodeBudget = 0;
    this.killNodes = 0;
    this.killStopped = false;
    this.currentSearchFeatures = null;
  }

  initBoard() {
    const board = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      board[i] = [];
      for (let j = 0; j < BOARD_SIZE; j++) {
        board[i][j] = EMPTY;
      }
    }
    return board;
  }

  // 放置棋子
  placeStone(row, col) {
    console.log('[DEBUG] placeStone 调用: row=', row, 'col=', col, 'turn=', this.turn, 'extraTurns=', this.extraTurns);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { success: false, message: '位置越界' };
    }

    if (this.board[row][col] !== EMPTY) {
      return { success: false, message: '该位置已有棋子' };
    }

    // 保存历史记录(用于悔棋)
    this.moveHistory.push({
      row,
      col,
      player: this.turn,
      mpBefore: { ...this.mp } // 深拷贝MP状态
    });

    this.board[row][col] = this.turn;
    this.moveCount++;

    // 下棋后增加内力 +5,上限200
    this.mp[this.turn] = Math.min(200, this.mp[this.turn] + 5);
    console.log('[DEBUG] 下棋后内力:', this.turn, '→', this.mp[this.turn]);

    // 检查胜利 (优先判定5连)
    const winLine = this.getWinLine(row, col, this.turn);
    if (winLine) {
      this.gameOver = true;
      this.winner = this.turn;
      console.log('[DEBUG] 游戏结束,胜者:', this.winner);

      // 如果同时满足禁手条件，但形成5连，则按5连胜处理
      return { success: true, gameOver: true, winner: this.turn, winLine };
    }

    // 检查禁手 (仅对黑方检查)
    if (this.turn === BLACK && this.hasForbidden(row, col, BLACK)) {
      console.log('[DEBUG] 黑方触发禁手，判负');
      this.gameOver = true;
      this.winner = WHITE;
      return { success: true, gameOver: true, winner: WHITE, forbidden: true, message: '禁手！黑方判负' };
    }

    // 检查额外回合
    if (this.extraTurns > 0) {
      this.extraTurns--;
      console.log('[DEBUG] 消耗1个额外回合,剩余:', this.extraTurns);
      return { success: true, extraTurn: true };
    }

    // 切换回合
    console.log('[DEBUG] 切换回合前:', this.turn);
    this.switchTurn();
    console.log('[DEBUG] 切换回合后:', this.turn);

    return { success: true };
  }

  // 激活技能
  activateSkill(skillId) {
    const skill = SKILLS[skillId];
    if (!skill) {
      return { success: false, message: '无效技能' };
    }

    if (this.mp[this.turn] < skill.cost) {
      return { success: false, message: '内力不足！' };
    }

    // 技能1(悔棋)、技能4(跳过回合)、技能5(重开)直接生效
    if (skillId === 1 || skillId === 4 || skillId === 5) {
      return this.useSkill(skillId, null, null);
    }

    // 技能2(炸毁十字)、技能3(移动棋子)需要选择目标
    this.currentSkill = skillId;
    return { success: true, needTarget: true };
  }

  // 使用技能
  useSkill(skillId, row, col) {
    const skill = SKILLS[skillId];
    const isSkill3SecondStep = skillId === 3 && !!this.selectedPiece;

    if (!skill) {
      return { success: false, message: '无法使用技能' };
    }

    // 技能3是两步操作，只有第一步扣费
    if (!isSkill3SecondStep) {
      if (this.mp[this.turn] < skill.cost) {
        return { success: false, message: '无法使用技能' };
      }
      this.mp[this.turn] -= skill.cost;
    }

    let effect = { skillId, skillName: skill.name };

    if (skillId === 1) {
      // 技能1: 时光倒流 - 黑白双方各悔一步
      console.log('[DEBUG] 技能1: 悔棋, 历史记录数:', this.moveHistory.length);

      if (this.moveHistory.length < 2) {
        // 退还内力
        this.mp[this.turn] += skill.cost;
        return { success: false, message: '至少需要黑白双方各下一步！' };
      }

      const revertEntries = [];
      const seenPlayers = new Set();
      for (let i = this.moveHistory.length - 1; i >= 0; i--) {
        const move = this.moveHistory[i];
        if (!seenPlayers.has(move.player)) {
          seenPlayers.add(move.player);
          revertEntries.push({ index: i, move });
          if (seenPlayers.size === 2) break;
        }
      }

      if (seenPlayers.size < 2) {
        this.mp[this.turn] += skill.cost;
        return { success: false, message: '至少需要黑白双方各下一步！' };
      }

      // 先删索引大的，避免 splice 影响索引
      revertEntries.sort((a, b) => b.index - a.index);
      const revertedMoves = [];
      for (const entry of revertEntries) {
        const { index, move } = entry;
        this.board[move.row][move.col] = EMPTY;
        this.moveHistory.splice(index, 1);
        this.moveCount = Math.max(0, this.moveCount - 1);
        revertedMoves.push({
          row: move.row,
          col: move.col,
          player: move.player
        });
      }

      effect.type = 'undo_pair';
      effect.positions = revertedMoves;
      console.log('[DEBUG] 悔棋成功,撤销:', revertedMoves);

      // 技能1使用后不切换回合，保持施法前后轮次一致
      this.currentSkill = null;
      return { success: true, effect };

    } else if (skillId === 2) {
      // 技能2: 力拔山兮 - 炸毁十字5格(中心+上下左右)
      console.log('[DEBUG] 技能2: 炸毁十字, 中心:', row, col);

      const positions = [];
      // 十字方向: 中心+上下左右各1格，最多5个棋子
      const directions = [
        [0, 0],   // 中心
        [-1, 0], [1, 0],   // 上下
        [0, -1], [0, 1]    // 左右
      ];

      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (this.board[nr][nc] !== EMPTY) {
            const piece = this.board[nr][nc];
            this.board[nr][nc] = EMPTY;
            positions.push({ row: nr, col: nc, player: piece });
          }
        }
      }

      effect.type = 'cross';
      effect.positions = positions;
      effect.center = { row, col };
      console.log('[DEBUG] 炸毁了', positions.length, '个棋子');

    } else if (skillId === 3) {
      // 技能3: 飞沙走石 - 移动对方棋子
      console.log('[DEBUG] 技能3: 移动棋子, 位置:', row, col, '已选择:', this.selectedPiece);

      if (!this.selectedPiece) {
        // 第一步: 选择要移动的敌子
        if (this.board[row][col] === EMPTY) {
          // 退还内力,重新选择
          this.mp[this.turn] += skill.cost;
          return { success: false, message: '请选择敌方棋子！' };
        }

        if (this.board[row][col] === this.turn) {
          // 退还内力,重新选择
          this.mp[this.turn] += skill.cost;
          return { success: false, message: '不能移动自己的棋子！' };
        }

        // 保存选中的棋子
        this.selectedPiece = { row, col };
        console.log('[DEBUG] 选中敌子:', this.selectedPiece);

        // 返回需要第二步
        return {
          success: true,
          needSecondTarget: true,
          effect: {
            skillId,
            skillName: skill.name,
            type: 'select',
            from: { row, col }
          }
        };

      } else {
        // 第二步: 选择目标位置
        if (this.board[row][col] !== EMPTY) {
          // 退还内力,重新选择
          this.mp[this.turn] += skill.cost;
          this.selectedPiece = null;
          return { success: false, message: '目标位置已有棋子！' };
        }

        // 移动棋子
        const piece = this.board[this.selectedPiece.row][this.selectedPiece.col];
        this.board[this.selectedPiece.row][this.selectedPiece.col] = EMPTY;
        this.board[row][col] = piece;

        effect.type = 'move';
        effect.from = this.selectedPiece;
        effect.to = { row, col };
        effect.player = piece;
        console.log('[DEBUG] 移动完成:', effect.from, '→', effect.to);

        this.selectedPiece = null;
        // 技能3使用后不切换回合，保持当前行动方不变
        this.currentSkill = null;
        return { success: true, effect };
      }
      
    } else if (skillId === 4) {
      // 技能4: 静如止水 - 跳过对方回合
      console.log('[DEBUG] 技能4: 跳过对方回合');

      this.skipNextTurn = true;
      effect.type = 'skip';

      // 不切换回合
      this.currentSkill = null;
      return { success: true, effect };

    } else if (skillId === 5) {
      // 技能5: 东山再起 - 重开棋局
      console.log('[DEBUG] 技能5: 重开棋局');

      const positions = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.board[r][c] !== EMPTY) {
            positions.push({ row: r, col: c, player: this.board[r][c] });
          }
        }
      }

      this.board = this.initBoard();
      this.moveCount = 0;
      this.moveHistory = [];
      effect.type = 'reset';
      effect.positions = positions;

      // 不切换回合
      this.currentSkill = null;
      return { success: true, effect };
    }

    this.currentSkill = null;
    
    // 切换回合
    this.switchTurn();
    
    return { success: true, effect };
  }

  // 取消技能
  cancelSkill() {
    this.currentSkill = null;
    this.selectedPiece = null;
    return { success: true };
  }

  // 切换回合
  switchTurn() {
    // 检查是否要跳过下一回合
    if (this.skipNextTurn) {
      console.log('[DEBUG] 跳过对方回合,继续当前玩家');
      this.skipNextTurn = false;
      // 不增加内力(内力只在下棋时增加)
      return; // 不切换回合
    }

    this.turn = this.turn === BLACK ? WHITE : BLACK;
    // 不增加内力(内力只在下棋时增加)
  }

  getCandidateMoves() {
    const candidates = [];
    const hasAnyStone = this.moveCount > 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== EMPTY) continue;
        if (!hasAnyStone || this.hasNeighbor(r, c, 2)) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    // 兜底，避免候选为空
    if (candidates.length === 0) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.board[r][c] === EMPTY) {
            candidates.push({ row: r, col: c });
          }
        }
      }
    }

    return candidates;
  }

  hasNeighbor(row, col, distance = 2) {
    for (let dr = -distance; dr <= distance; dr++) {
      for (let dc = -distance; dc <= distance; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (!this.isValidPos(nr, nc)) continue;
        if (this.board[nr][nc] !== EMPTY) return true;
      }
    }
    return false;
  }

  isForbiddenMove(row, col, player) {
    if (player !== BLACK) return false;
    if (this.board[row][col] !== EMPTY) return true;

    this.board[row][col] = player;
    const isWin = this.checkWin(row, col, player);
    const forbidden = !isWin && this.hasForbidden(row, col, player, true);
    this.board[row][col] = EMPTY;
    return forbidden;
  }

  getMoveTacticalMetrics(row, col, player) {
    if (this.board[row][col] !== EMPTY) return null;

    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    const metrics = {
      win: false,
      openFour: 0,
      closedFour: 0,
      openThree: 0,
      sleepThree: 0,
      openTwo: 0,
      sleepTwo: 0
    };

    this.board[row][col] = player;
    metrics.win = this.checkWin(row, col, player);

    for (const [dr, dc] of dirs) {
      const line = this.countLineInDirection(row, col, player, dr, dc);
      const count = line.count;
      const open = line.openEnds;

      if (count >= 5) {
        metrics.win = true;
      } else if (count === 4) {
        if (open === 2) metrics.openFour++;
        else if (open === 1) metrics.closedFour++;
      } else if (count === 3) {
        if (open === 2) metrics.openThree++;
        else if (open === 1) metrics.sleepThree++;
      } else if (count === 2) {
        if (open === 2) metrics.openTwo++;
        else if (open === 1) metrics.sleepTwo++;
      }
    }

    this.board[row][col] = EMPTY;
    return metrics;
  }

  getThreatSeverity(metrics) {
    if (!metrics) return 0;
    if (metrics.win) return 1000;
    return (
      metrics.openFour * 220 +
      metrics.closedFour * 120 +
      metrics.openThree * 42 +
      metrics.sleepThree * 18 +
      metrics.openTwo * 6 +
      metrics.sleepTwo * 2
    );
  }

  findAllImmediateWinMoves(player, moves) {
    const list = [];
    const sourceMoves = moves || this.getCandidateMoves();
    for (const move of sourceMoves) {
      const metrics = this.getMoveTacticalMetrics(move.row, move.col, player);
      if (metrics && metrics.win) {
        list.push(move);
      }
    }
    return list;
  }

  collectThreats(player, moves) {
    const sourceMoves = moves || this.getCandidateMoves();
    const threats = [];

    for (const move of sourceMoves) {
      const metrics = this.getMoveTacticalMetrics(move.row, move.col, player);
      const severity = this.getThreatSeverity(metrics);
      if (severity > 0) {
        threats.push({
          row: move.row,
          col: move.col,
          severity,
          metrics
        });
      }
    }

    threats.sort((a, b) => b.severity - a.severity);
    return threats;
  }

  pickBestMove(moves, aiPlayer, opponent) {
    let best = null;
    let bestScore = -Infinity;

    for (const move of moves) {
      if (this.isForbiddenMove(move.row, move.col, aiPlayer)) continue;

      const attack = this.getMoveTacticalMetrics(move.row, move.col, aiPlayer);
      const defend = this.getMoveTacticalMetrics(move.row, move.col, opponent);

      let score = 0;
      if (attack && attack.win) score += 1000000000;
      if (defend && defend.win) score += 900000000;

      if (attack) {
        score += attack.openFour * 300000;
        score += attack.closedFour * 130000;
        score += attack.openThree * 26000;
        score += attack.sleepThree * 6000;
        score += attack.openTwo * 1200;
        score += attack.sleepTwo * 260;
      }
      if (defend) {
        score += defend.openFour * 280000;
        score += defend.closedFour * 120000;
        score += defend.openThree * 32000;
        score += defend.sleepThree * 7000;
        score += defend.openTwo * 1400;
        score += defend.sleepTwo * 280;
      }

      score += this.evaluate(move.row, move.col, aiPlayer) * 7.2;
      score += this.evaluate(move.row, move.col, opponent) * 6.9;

      // 中央偏好，避免边角过早飘
      const center = Math.floor(BOARD_SIZE / 2);
      const centerDist = Math.abs(move.row - center) + Math.abs(move.col - center);
      score += Math.max(0, 16 - centerDist);

      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }

    return best;
  }

  estimateCrossImpact(row, col, targetPlayer) {
    const dirs = [[0,0], [-1,0], [1,0], [0,-1], [0,1]];
    let count = 0;
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (!this.isValidPos(nr, nc)) continue;
      if (this.board[nr][nc] === targetPlayer) count++;
    }
    return count;
  }

  getOpeningBookPoints() {
    const center = Math.floor(BOARD_SIZE / 2);
    return [
      { row: center, col: center, weight: 1000 },
      { row: center - 1, col: center - 1, weight: 780 },
      { row: center - 1, col: center + 1, weight: 770 },
      { row: center + 1, col: center - 1, weight: 770 },
      { row: center + 1, col: center + 1, weight: 780 },
      { row: center, col: center - 1, weight: 660 },
      { row: center - 1, col: center, weight: 650 },
      { row: center, col: center + 1, weight: 650 },
      { row: center + 1, col: center, weight: 660 },
      { row: center - 2, col: center - 2, weight: 520 },
      { row: center - 2, col: center + 2, weight: 515 },
      { row: center + 2, col: center - 2, weight: 515 },
      { row: center + 2, col: center + 2, weight: 520 },
      { row: center - 2, col: center, weight: 455 },
      { row: center, col: center - 2, weight: 455 },
      { row: center, col: center + 2, weight: 450 },
      { row: center + 2, col: center, weight: 450 }
    ];
  }

  getOpeningBookMove(aiPlayer, opponent) {
    if (this.moveCount > 8) return null;

    const center = Math.floor(BOARD_SIZE / 2);
    if (this.board[center][center] === EMPTY && !this.isForbiddenMove(center, center, aiPlayer)) {
      return { row: center, col: center, book: 'center' };
    }

    const lastOpponent = this.getLastMoveByPlayer(opponent);
    const lastSelf = this.getLastMoveByPlayer(aiPlayer);
    const preferred = [];

    if (lastOpponent) {
      const mirror = {
        row: center * 2 - lastOpponent.row,
        col: center * 2 - lastOpponent.col,
        weight: 980
      };
      preferred.push(mirror);

      const dr = Math.sign(lastOpponent.row - center) || 1;
      const dc = Math.sign(lastOpponent.col - center) || 1;
      preferred.push({ row: center - dr, col: center - dc, weight: 920 });
      preferred.push({ row: center + dc, col: center - dr, weight: 760 });
      preferred.push({ row: center - dc, col: center + dr, weight: 750 });
    }

    if (lastSelf) {
      const extendRow = lastSelf.row + Math.sign(lastSelf.row - center);
      const extendCol = lastSelf.col + Math.sign(lastSelf.col - center);
      preferred.push({ row: extendRow, col: extendCol, weight: 700 });
    }

    const bookPoints = preferred.concat(this.getOpeningBookPoints());
    let best = null;
    let bestScore = -Infinity;

    for (const item of bookPoints) {
      const row = item.row;
      const col = item.col;
      if (!this.isValidPos(row, col) || this.board[row][col] !== EMPTY) continue;
      if (this.isForbiddenMove(row, col, aiPlayer)) continue;

      const dist = Math.abs(row - center) + Math.abs(col - center);
      const ownShape = this.evaluate(row, col, aiPlayer);
      const enemyShape = this.evaluate(row, col, opponent);
      const score =
        (item.weight || 0) +
        ownShape * 1.8 +
        enemyShape * 1.2 +
        Math.max(0, 14 - dist) * 8;

      if (score > bestScore) {
        bestScore = score;
        best = { row, col };
      }
    }

    return best;
  }

  getLastMoveByPlayer(player) {
    if (!Array.isArray(this.moveHistory) || this.moveHistory.length === 0) {
      return this.findLastPlacedStone(player);
    }

    for (let i = this.moveHistory.length - 1; i >= 0; i--) {
      const move = this.moveHistory[i];
      if (move.player === player && this.board[move.row][move.col] === player) {
        return { row: move.row, col: move.col };
      }
    }

    return this.findLastPlacedStone(player);
  }

  findLastPlacedStone(player) {
    const center = Math.floor(BOARD_SIZE / 2);
    let best = null;
    let bestDist = Infinity;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== player) continue;
        const dist = Math.abs(r - center) + Math.abs(c - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = { row: r, col: c };
        }
      }
    }

    return best;
  }

  getOrderedMovesForSearch(currentPlayer, aiPlayer, opponent, limit = 12) {
    const other = currentPlayer === BLACK ? WHITE : BLACK;
    const center = Math.floor(BOARD_SIZE / 2);
    const scored = [];
    const candidates = this.getCandidateMoves();

    for (const move of candidates) {
      if (this.isForbiddenMove(move.row, move.col, currentPlayer)) continue;

      const selfMetrics = this.getMoveTacticalMetrics(move.row, move.col, currentPlayer);
      const oppMetrics = this.getMoveTacticalMetrics(move.row, move.col, other);

      let score = 0;
      if (selfMetrics && selfMetrics.win) score += 1000000;
      if (oppMetrics && oppMetrics.win) score += 900000;
      score += this.getThreatSeverity(selfMetrics) * 24;
      score += this.getThreatSeverity(oppMetrics) * 16;
      score += this.evaluate(move.row, move.col, currentPlayer) * 5.5;
      score += this.evaluate(move.row, move.col, other) * 4.8;
      score += Math.max(0, 14 - (Math.abs(move.row - center) + Math.abs(move.col - center)));
      score += this.getHistoryBonus(currentPlayer, move.row, move.col) * 0.7;

      // 对于对手层，也按高威胁优先排序，便于剪枝
      if (currentPlayer !== aiPlayer) {
        score += this.getThreatSeverity(selfMetrics) * 2;
      }

      scored.push({ ...move, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  getHistoryKey(player, row, col) {
    return `${player}|${row}|${col}`;
  }

  getHistoryBonus(player, row, col) {
    return this.historyHeuristic.get(this.getHistoryKey(player, row, col)) || 0;
  }

  bumpHistory(player, row, col, depth) {
    const key = this.getHistoryKey(player, row, col);
    const prev = this.historyHeuristic.get(key) || 0;
    const next = prev + depth * depth;
    this.historyHeuristic.set(key, next > 40000 ? 40000 : next);
  }

  getKillerKey(depth, player) {
    return `${depth}|${player}`;
  }

  getKillerMoves(depth, player) {
    return this.killerMoves.get(this.getKillerKey(depth, player)) || [];
  }

  bumpKillerMove(depth, player, row, col) {
    const key = this.getKillerKey(depth, player);
    const list = this.killerMoves.get(key) || [];
    const next = [{ row, col }];

    for (const item of list) {
      if (item.row === row && item.col === col) continue;
      next.push(item);
      if (next.length >= 2) break;
    }

    this.killerMoves.set(key, next);
  }

  prioritizeMove(moves, preferredMove) {
    if (!preferredMove || !moves || moves.length < 2) return moves;
    const idx = moves.findIndex(m => m.row === preferredMove.row && m.col === preferredMove.col);
    if (idx <= 0) return moves;
    const picked = moves[idx];
    const reordered = [picked];
    for (let i = 0; i < moves.length; i++) {
      if (i !== idx) reordered.push(moves[i]);
    }
    return reordered;
  }

  getBoardKey(currentPlayer) {
    return `${currentPlayer}|${this.getBoardSignature()}`;
  }

  getBoardSignature() {
    const rows = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      rows.push(this.board[r].join(''));
    }
    return rows.join('');
  }

  getVctLayerKey(attacker, defender, depth, phaseTag) {
    return `${attacker}|${defender}|d${depth}|${phaseTag}`;
  }

  getVctLayer(attacker, defender, depth, phaseTag) {
    const key = this.getVctLayerKey(attacker, defender, depth, phaseTag);
    if (!this.vctTranspositionLayers.has(key)) {
      this.vctTranspositionLayers.set(key, new Map());
    }
    return this.vctTranspositionLayers.get(key);
  }

  getVctCacheEntry(attacker, defender, depth, phaseTag) {
    const layer = this.getVctLayer(attacker, defender, depth, phaseTag);
    const key = this.getBoardSignature();
    if (!layer.has(key)) return null;
    return layer.get(key);
  }

  setVctCacheEntry(attacker, defender, depth, phaseTag, value) {
    const layer = this.getVctLayer(attacker, defender, depth, phaseTag);
    if (layer.size > 12000) layer.clear();
    layer.set(this.getBoardSignature(), value);
  }

  isSearchBudgetExceeded() {
    if (this.searchNodeBudget > 0 && this.searchNodes >= this.searchNodeBudget) return true;
    if (this.searchDeadline > 0 && Date.now() >= this.searchDeadline) return true;
    return false;
  }

  analyzePositionFeatures(aiPlayer, opponent, candidateMoves) {
    const moves = candidateMoves || this.getCandidateMoves();
    const aiThreats = this.collectThreats(aiPlayer, moves);
    const oppThreats = this.collectThreats(opponent, moves);
    const topAi = aiThreats[0];
    const topOpp = oppThreats[0];
    const aiCritical = aiThreats.filter(t => t.severity >= 120).length;
    const oppCritical = oppThreats.filter(t => t.severity >= 120).length;
    const aiTempoThreats = aiThreats.filter(t => t.metrics && (t.metrics.openFour > 0 || t.metrics.openThree >= 2)).length;
    const oppTempoThreats = oppThreats.filter(t => t.metrics && (t.metrics.openFour > 0 || t.metrics.openThree >= 2)).length;
    const volatility =
      (topAi ? topAi.severity : 0) +
      (topOpp ? topOpp.severity : 0) +
      aiCritical * 55 +
      oppCritical * 70 +
      aiTempoThreats * 90 +
      oppTempoThreats * 110;

    return {
      candidateCount: moves.length,
      topAiSeverity: topAi ? topAi.severity : 0,
      topOppSeverity: topOpp ? topOpp.severity : 0,
      aiCritical,
      oppCritical,
      aiTempoThreats,
      oppTempoThreats,
      volatility,
      tactical: volatility >= 260 || oppTempoThreats > 0 || aiTempoThreats > 0,
      endgame: this.moveCount >= 32,
      early: this.moveCount <= 10
    };
  }

  getDynamicDepthBonus(features) {
    if (!features) return 0;
    let bonus = 0;
    if (features.tactical) bonus++;
    if (features.oppTempoThreats > 0 || features.aiTempoThreats > 0) bonus++;
    if (features.candidateCount <= 10 && features.volatility >= 180) bonus++;
    if (features.endgame && features.candidateCount <= 14) bonus++;
    return Math.min(2, bonus);
  }

  getSearchTimeBudget(candidateCount, features = null) {
    let budget;
    if (candidateCount <= 8) budget = 320;
    else if (candidateCount <= 12) budget = 240;
    else if (candidateCount <= 16) budget = 180;
    else budget = 140;

    if (features && features.tactical) budget += 70;
    if (features && features.endgame && candidateCount <= 14) budget += 60;
    return Math.min(420, budget);
  }

  getSearchNodeBudget(candidateCount, features = null) {
    let budget;
    if (candidateCount <= 8) budget = 26000;
    else if (candidateCount <= 12) budget = 19000;
    else if (candidateCount <= 16) budget = 14000;
    else budget = 9500;

    if (features && features.tactical) budget += 6500;
    if (features && features.endgame && candidateCount <= 14) budget += 5000;
    return Math.min(36000, budget);
  }

  getKillSearchDepth(candidateCount, features = null) {
    let depth;
    if (this.moveCount < 8) depth = 4;
    else if (candidateCount <= 7) depth = 8;
    else if (candidateCount <= 11) depth = 7;
    else if (candidateCount <= 16) depth = 6;
    else depth = 5;

    if (features && features.tactical && candidateCount <= 18) depth++;
    if (features && features.endgame && candidateCount <= 12) depth++;
    return Math.min(9, depth);
  }

  getKillTimeBudget(candidateCount, features = null) {
    let budget;
    if (candidateCount <= 8) budget = 260;
    else if (candidateCount <= 12) budget = 220;
    else if (candidateCount <= 16) budget = 180;
    else budget = 130;

    if (features && features.tactical) budget += 90;
    if (features && features.endgame && candidateCount <= 14) budget += 60;
    return Math.min(420, budget);
  }

  getKillNodeBudget(candidateCount, features = null) {
    let budget;
    if (candidateCount <= 8) budget = 18000;
    else if (candidateCount <= 12) budget = 14000;
    else if (candidateCount <= 16) budget = 11000;
    else budget = 8000;

    if (features && features.tactical) budget += 7000;
    if (features && features.endgame && candidateCount <= 14) budget += 5000;
    return Math.min(30000, budget);
  }

  isKillBudgetExceeded() {
    if (this.killNodeBudget > 0 && this.killNodes >= this.killNodeBudget) return true;
    if (this.killDeadline > 0 && Date.now() >= this.killDeadline) return true;
    return false;
  }

  evaluateBoardState(aiPlayer, opponent) {
    const candidates = this.getCandidateMoves();
    const aiThreats = this.collectThreats(aiPlayer, candidates);
    const oppThreats = this.collectThreats(opponent, candidates);

    let score = 0;
    const aiTop = aiThreats.slice(0, 4);
    const oppTop = oppThreats.slice(0, 4);

    aiTop.forEach((t, idx) => {
      const weight = idx === 0 ? 1.4 : (idx === 1 ? 1.1 : 0.8);
      score += t.severity * weight;
    });
    oppTop.forEach((t, idx) => {
      const weight = idx === 0 ? 1.55 : (idx === 1 ? 1.2 : 0.85);
      score -= t.severity * weight;
    });

    // 轻量子力差，避免纯局部最优
    let aiCount = 0;
    let oppCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] === aiPlayer) aiCount++;
        else if (this.board[r][c] === opponent) oppCount++;
      }
    }
    score += (aiCount - oppCount) * 3;

    return score;
  }

  alphaBeta(depth, alpha, beta, currentPlayer, aiPlayer, opponent) {
    this.searchNodes++;
    if ((this.searchNodes & 31) === 0 && this.isSearchBudgetExceeded()) {
      this.searchStopped = true;
      return this.evaluateBoardState(aiPlayer, opponent);
    }

    if (depth <= 0) {
      return this.evaluateBoardState(aiPlayer, opponent);
    }

    const alphaOriginal = alpha;
    const betaOriginal = beta;
    const ttKey = this.getBoardKey(currentPlayer);
    const ttEntry = this.transpositionTable.get(ttKey);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === 'EXACT') return ttEntry.score;
      if (ttEntry.flag === 'LOWER') alpha = Math.max(alpha, ttEntry.score);
      else if (ttEntry.flag === 'UPPER') beta = Math.min(beta, ttEntry.score);
      if (beta <= alpha) return ttEntry.score;
    }

    const moveLimit = this.getSearchMoveLimit(depth);
    let orderedMoves = this.getOrderedMovesForSearch(currentPlayer, aiPlayer, opponent, moveLimit);
    if (ttEntry && ttEntry.bestMove) {
      orderedMoves = this.prioritizeMove(orderedMoves, ttEntry.bestMove);
    }
    const killers = this.getKillerMoves(depth, currentPlayer);
    for (const killer of killers) {
      orderedMoves = this.prioritizeMove(orderedMoves, killer);
    }
    if (orderedMoves.length === 0) {
      return this.evaluateBoardState(aiPlayer, opponent);
    }

    const maximizing = currentPlayer === aiPlayer;
    let best = maximizing ? -Infinity : Infinity;
    let bestMove = null;

    for (const move of orderedMoves) {
      const { row, col } = move;
      this.board[row][col] = currentPlayer;

      let score;
      const isWin = this.checkWin(row, col, currentPlayer);
      const isForbidden = !isWin && currentPlayer === BLACK && this.hasForbidden(row, col, currentPlayer, true);

      if (isWin) {
        score = maximizing ? 100000000 : -100000000;
      } else if (isForbidden) {
        // 黑方禁手：当前行动方直接判负
        score = maximizing ? -100000000 : 100000000;
      } else {
        const nextPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        score = this.alphaBeta(depth - 1, alpha, beta, nextPlayer, aiPlayer, opponent);
      }

      this.board[row][col] = EMPTY;

      if (maximizing) {
        if (score > best) {
          best = score;
          bestMove = { row, col };
        }
        if (best > alpha) alpha = best;
      } else {
        if (score < best) {
          best = score;
          bestMove = { row, col };
        }
        if (best < beta) beta = best;
      }

      if (beta <= alpha) {
        this.bumpHistory(currentPlayer, row, col, depth);
        this.bumpKillerMove(depth, currentPlayer, row, col);
        break;
      }
      if (this.searchStopped) break;
    }

    let flag = 'EXACT';
    if (best <= alphaOriginal) flag = 'UPPER';
    else if (best >= betaOriginal) flag = 'LOWER';
    if (this.transpositionTable.size > 50000) this.transpositionTable.clear();
    this.transpositionTable.set(ttKey, {
      depth,
      score: best,
      flag,
      bestMove
    });

    return best;
  }

  getSearchDepth(candidateCount, features = null) {
    let depth;
    if (this.moveCount < 4) depth = 4;
    else if (candidateCount <= 7) depth = 7;
    else if (candidateCount <= 10) depth = 6;
    else if (candidateCount <= 14) depth = 5;
    else if (candidateCount <= 18) depth = 4;
    else depth = 3;

    depth += this.getDynamicDepthBonus(features);
    return Math.min(8, depth);
  }

  getSearchMoveLimit(depth) {
    const features = this.currentSearchFeatures;
    let limit = depth >= 3 ? 10 : 12;
    if (features && features.tactical) limit += 2;
    if (features && features.endgame && features.candidateCount <= 14) limit += 2;
    return Math.min(16, limit);
  }

  getForcedAttackMoves(attacker, defender, depth = 4, limit = 6) {
    const ordered = this.getOrderedMovesForSearch(attacker, attacker, defender, 18);
    const forcing = [];

    for (const move of ordered) {
      const { row, col } = move;
      if (this.isForbiddenMove(row, col, attacker)) continue;

      const metrics = this.getMoveTacticalMetrics(row, col, attacker);
      this.board[row][col] = attacker;
      const win = this.checkWin(row, col, attacker);
      const nextWins = this.findAllImmediateWinMoves(attacker, this.getCandidateMoves())
        .filter(m => !this.isForbiddenMove(m.row, m.col, attacker));
      this.board[row][col] = EMPTY;

      const isForcing =
        win ||
        nextWins.length > 0 ||
        (metrics && metrics.openFour > 0) ||
        (metrics && metrics.closedFour > 0) ||
        (metrics && metrics.openThree >= 2) ||
        (depth >= 5 && metrics && metrics.openThree >= 1 && metrics.sleepThree >= 1);

      if (!isForcing) continue;

      let score = 0;
      if (win) score += 1000000;
      score += nextWins.length * 10000;
      if (metrics) {
        score += metrics.openFour * 6000;
        score += metrics.closedFour * 2600;
        score += metrics.openThree * 1200;
        score += metrics.sleepThree * 350;
      }
      score += (move.score || 0) * 0.8;
      score += this.getHistoryBonus(attacker, row, col) * 0.3;
      forcing.push({ row, col, score });
    }

    forcing.sort((a, b) => b.score - a.score);
    return forcing.slice(0, limit);
  }

  getCriticalDefensePoints(row, col, player) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    const seen = new Set();
    const points = [];

    for (const [dr, dc] of dirs) {
      let forwardStep = 1;
      while (this.isValidPos(row + forwardStep * dr, col + forwardStep * dc) &&
             this.board[row + forwardStep * dr][col + forwardStep * dc] === player) {
        forwardStep++;
      }

      let backwardStep = 1;
      while (this.isValidPos(row - backwardStep * dr, col - backwardStep * dc) &&
             this.board[row - backwardStep * dr][col - backwardStep * dc] === player) {
        backwardStep++;
      }

      const count = forwardStep + backwardStep - 1;
      const forwardRow = row + forwardStep * dr;
      const forwardCol = col + forwardStep * dc;
      const backwardRow = row - backwardStep * dr;
      const backwardCol = col - backwardStep * dc;
      const forwardOpen = this.isValidPos(forwardRow, forwardCol) && this.board[forwardRow][forwardCol] === EMPTY;
      const backwardOpen = this.isValidPos(backwardRow, backwardCol) && this.board[backwardRow][backwardCol] === EMPTY;
      const openEnds = (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0);

      if (count >= 4 || (count === 3 && openEnds === 2)) {
        if (forwardOpen) {
          const key = `${forwardRow}|${forwardCol}`;
          if (!seen.has(key)) {
            seen.add(key);
            points.push({ row: forwardRow, col: forwardCol });
          }
        }
        if (backwardOpen) {
          const key = `${backwardRow}|${backwardCol}`;
          if (!seen.has(key)) {
            seen.add(key);
            points.push({ row: backwardRow, col: backwardCol });
          }
        }
      }
    }

    return points;
  }

  getDefenderMandatoryResponses(attacker, defender, attackMove, depth, cap = 6) {
    const unique = new Map();
    const winningPoints = this.findAllImmediateWinMoves(attacker, this.getCandidateMoves())
      .filter(m => !this.isForbiddenMove(m.row, m.col, defender));

    for (const move of winningPoints) {
      unique.set(`${move.row}|${move.col}`, { row: move.row, col: move.col, score: 1000000 });
    }

    const critical = this.getCriticalDefensePoints(attackMove.row, attackMove.col, attacker);
    for (const move of critical) {
      if (this.isForbiddenMove(move.row, move.col, defender)) continue;
      const key = `${move.row}|${move.col}`;
      const prev = unique.get(key);
      const score = 120000 + this.evaluate(move.row, move.col, attacker);
      if (!prev || score > prev.score) unique.set(key, { row: move.row, col: move.col, score });
    }

    // 深度较深时扩展防守集，减少“伪强杀”误判
    if (depth >= 4) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const row = attackMove.row + dr;
          const col = attackMove.col + dc;
          if (!this.isValidPos(row, col) || this.board[row][col] !== EMPTY) continue;
          if (this.isForbiddenMove(row, col, defender)) continue;
          const key = `${row}|${col}`;
          if (unique.has(key)) continue;
          const score =
            this.evaluate(row, col, attacker) * 1.1 +
            this.evaluate(row, col, defender) * 0.75 +
            Math.max(0, 10 - (Math.abs(dr) + Math.abs(dc)));
          unique.set(key, { row, col, score });
        }
      }
    }

    const list = Array.from(unique.values());
    list.sort((a, b) => b.score - a.score);
    return list.slice(0, cap).map(item => ({ row: item.row, col: item.col }));
  }

  canForceWinSequence(attacker, defender, depth, lastAttack = null) {
    this.killNodes++;
    if ((this.killNodes & 15) === 0 && this.isKillBudgetExceeded()) {
      this.killStopped = true;
      return false;
    }
    if (this.killStopped) return false;
    if (depth <= 0) return false;

    const phase = lastAttack ? `${lastAttack.row},${lastAttack.col}` : 'root';
    const cached = this.getVctCacheEntry(attacker, defender, depth, phase);
    if (cached !== null) {
      return cached;
    }

    // 当前局面若已存在立即赢点，则强制成立
    const immediate = this.findAllImmediateWinMoves(attacker, this.getCandidateMoves())
      .filter(m => !this.isForbiddenMove(m.row, m.col, attacker));
    if (immediate.length > 0) {
      this.setVctCacheEntry(attacker, defender, depth, phase, true);
      return true;
    }

    const attackMoves = this.getForcedAttackMoves(attacker, defender, depth, 6);
    if (attackMoves.length === 0) {
      this.setVctCacheEntry(attacker, defender, depth, phase, false);
      return false;
    }

    for (const atk of attackMoves) {
      if (this.killStopped) break;
      const { row, col } = atk;
      this.board[row][col] = attacker;

      let forced = false;
      const winNow = this.checkWin(row, col, attacker);
      const forbiddenNow = !winNow && attacker === BLACK && this.hasForbidden(row, col, attacker, true);
      if (forbiddenNow) {
        this.board[row][col] = EMPTY;
        continue;
      }

      if (winNow) {
        forced = true;
      } else {
        const responses = this.getDefenderMandatoryResponses(attacker, defender, { row, col }, depth, 6);
        if (responses.length === 0) {
          forced = true;
        } else {
          let allBroken = true;
          let legalDefenses = 0;
          for (const def of responses) {
            if (this.board[def.row][def.col] !== EMPTY) continue;
            this.board[def.row][def.col] = defender;
            const defenderWins = this.checkWin(def.row, def.col, defender);
            const defenderForbidden = !defenderWins && defender === BLACK && this.hasForbidden(def.row, def.col, defender, true);
            if (!defenderForbidden) legalDefenses++;

            let branchForced = false;
            if (!defenderForbidden && !defenderWins) {
              branchForced = this.canForceWinSequence(attacker, defender, depth - 1, { row, col });
            }

            this.board[def.row][def.col] = EMPTY;
            if (!branchForced) {
              allBroken = false;
              break;
            }
          }
          if (legalDefenses === 0) allBroken = true;
          forced = allBroken;
        }
      }

      this.board[row][col] = EMPTY;
      if (forced) {
        this.setVctCacheEntry(attacker, defender, depth, phase, true);
        return true;
      }
    }

    this.setVctCacheEntry(attacker, defender, depth, phase, false);
    return false;
  }

  searchForcedKillMove(attacker, defender, depth = 4, features = null) {
    const candidateCount = this.getCandidateMoves().length;
    const maxDepth = Math.max(3, depth);
    const timeBudget = this.getKillTimeBudget(candidateCount, features);
    const nodeBudget = this.getKillNodeBudget(candidateCount, features);

    this.killDeadline = Date.now() + timeBudget;
    this.killNodeBudget = nodeBudget;
    this.killNodes = 0;
    this.killStopped = false;
    this.vctTranspositionLayers.clear();

    let best = null;
    const startedAt = Date.now();
    let rootMoves = this.getForcedAttackMoves(attacker, defender, maxDepth, 7);
    for (let curDepth = 3; curDepth <= maxDepth; curDepth++) {
      if (this.killStopped) break;
      rootMoves = this.prioritizeMove(rootMoves, best);

      let foundAtDepth = null;
      for (const atk of rootMoves) {
        if ((this.killNodes & 15) === 0 && this.isKillBudgetExceeded()) {
          this.killStopped = true;
          break;
        }

        const { row, col } = atk;
        if (this.isForbiddenMove(row, col, attacker)) continue;

        this.board[row][col] = attacker;
        const winNow = this.checkWin(row, col, attacker);
        const forbiddenNow = !winNow && attacker === BLACK && this.hasForbidden(row, col, attacker, true);

        let ok = false;
        if (!forbiddenNow) {
          if (winNow) {
            ok = true;
          } else {
            const responses = this.getDefenderMandatoryResponses(attacker, defender, { row, col }, curDepth, 6);
            if (responses.length === 0) {
              ok = true;
            } else {
              let allForced = true;
              let legalDefenses = 0;
              for (const def of responses) {
                if (this.board[def.row][def.col] !== EMPTY) continue;
                this.board[def.row][def.col] = defender;
                const defenderWins = this.checkWin(def.row, def.col, defender);
                const defenderForbidden = !defenderWins && defender === BLACK && this.hasForbidden(def.row, def.col, defender, true);
                if (!defenderForbidden) legalDefenses++;
                let branch = false;
                if (!defenderForbidden && !defenderWins) {
                  branch = this.canForceWinSequence(attacker, defender, curDepth - 1, { row, col });
                }
                this.board[def.row][def.col] = EMPTY;
                if (!branch) {
                  allForced = false;
                  break;
                }
                if (this.killStopped) {
                  allForced = false;
                  break;
                }
              }
              if (legalDefenses === 0) allForced = true;
              ok = allForced;
            }
          }
        }

        this.board[row][col] = EMPTY;
        if (ok) {
          foundAtDepth = { row, col };
          break;
        }
      }

      if (foundAtDepth && !this.killStopped) {
        best = foundAtDepth;
      } else if (!foundAtDepth) {
        break;
      }
      if (this.killStopped) break;
    }

    console.log('[DEBUG] 杀棋搜索统计:', {
      attacker,
      defender,
      maxDepth,
      nodes: this.killNodes,
      budgetNodes: this.killNodeBudget,
      timeBudget,
      elapsed: Date.now() - startedAt,
      stopped: this.killStopped,
      found: !!best
    });
    return best;
  }

  searchBestMove(aiPlayer, opponent, features = null) {
    const rootLimit = features && features.tactical ? 18 : 16;
    let orderedRoot = this.getOrderedMovesForSearch(aiPlayer, aiPlayer, opponent, rootLimit);
    if (orderedRoot.length === 0) return null;

    const searchFeatures = features || this.analyzePositionFeatures(aiPlayer, opponent, orderedRoot);
    const maxDepth = this.getSearchDepth(orderedRoot.length, searchFeatures);
    const timeBudget = this.getSearchTimeBudget(orderedRoot.length, searchFeatures);
    const nodeBudget = this.getSearchNodeBudget(orderedRoot.length, searchFeatures);

    this.searchDeadline = Date.now() + timeBudget;
    this.searchNodeBudget = nodeBudget;
    this.searchNodes = 0;
    this.searchStopped = false;
    this.transpositionTable.clear();
    this.killerMoves.clear();
    this.currentSearchFeatures = searchFeatures;

    let bestMove = { row: orderedRoot[0].row, col: orderedRoot[0].col };
    let bestScore = -Infinity;

    for (let depth = 2; depth <= maxDepth; depth++) {
      if (this.searchStopped) break;

      orderedRoot = this.prioritizeMove(orderedRoot, bestMove);
      let iterBestMove = null;
      let iterBestScore = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;

      for (const move of orderedRoot) {
        if ((this.searchNodes & 31) === 0 && this.isSearchBudgetExceeded()) {
          this.searchStopped = true;
          break;
        }

        const { row, col } = move;
        this.board[row][col] = aiPlayer;

        let score;
        const isWin = this.checkWin(row, col, aiPlayer);
        const isForbidden = !isWin && aiPlayer === BLACK && this.hasForbidden(row, col, aiPlayer, true);

        if (isWin) {
          score = 100000000 - depth;
        } else if (isForbidden) {
          score = -100000000 + depth;
        } else {
          score = this.alphaBeta(depth - 1, alpha, beta, opponent, aiPlayer, opponent);
        }

        this.board[row][col] = EMPTY;
        move.score = score;

        if (score > iterBestScore) {
          iterBestScore = score;
          iterBestMove = { row, col };
        }
        if (score > alpha) alpha = score;
        if (this.searchStopped) break;
      }

      if (iterBestMove && !this.searchStopped) {
        bestMove = iterBestMove;
        bestScore = iterBestScore;
        orderedRoot.sort((a, b) => (b.score || -Infinity) - (a.score || -Infinity));
      }
    }

    console.log('[DEBUG] 搜索统计:', {
      nodes: this.searchNodes,
      budgetNodes: this.searchNodeBudget,
      timeBudget,
      maxDepth,
      features: {
        volatility: searchFeatures.volatility,
        tactical: searchFeatures.tactical,
        candidateCount: searchFeatures.candidateCount
      },
      stopped: this.searchStopped,
      bestScore
    });

    this.currentSearchFeatures = null;
    return bestMove;
  }

  // AI 下棋
  aiMove() {
    console.log('[DEBUG] aiMove 开始: turn=', this.turn, 'gameOver=', this.gameOver);

    if (this.gameOver) {
      console.log('[DEBUG] aiMove 被阻止');
      return { success: false };
    }

    const aiPlayer = this.turn;
    const opponent = aiPlayer === BLACK ? WHITE : BLACK;
    const candidateMoves = this.getCandidateMoves();

    // 1. 能立即赢就直接赢
    const aiWins = this.findAllImmediateWinMoves(aiPlayer, candidateMoves)
      .filter(m => !this.isForbiddenMove(m.row, m.col, aiPlayer));
    if (aiWins.length > 0) {
      const bestWin = this.pickBestMove(aiWins, aiPlayer, opponent) || aiWins[0];
      console.log('[DEBUG] AI立即制胜:', bestWin);
      return this.placeStone(bestWin.row, bestWin.col);
    }

    // 2. 对手有立即赢点就必防
    const opponentWins = this.findAllImmediateWinMoves(opponent, candidateMoves);
    if (opponentWins.length > 0) {
      const blocks = opponentWins.filter(m => !this.isForbiddenMove(m.row, m.col, aiPlayer));
      const bestBlock = this.pickBestMove(blocks, aiPlayer, opponent);
      if (bestBlock) {
        console.log('[DEBUG] AI执行必防:', bestBlock);
        return this.placeStone(bestBlock.row, bestBlock.col);
      }
    }

    const positionFeatures = this.analyzePositionFeatures(aiPlayer, opponent, candidateMoves);

    // 3. 开局库：无紧急战术时优先走定式，减少开局乱飘
    const openingBookMove = !positionFeatures.tactical
      ? this.getOpeningBookMove(aiPlayer, opponent)
      : null;
    if (openingBookMove) {
      console.log('[DEBUG] AI开局库选择:', openingBookMove);
      return this.placeStone(openingBookMove.row, openingBookMove.col);
    }

    // 4. 技能触发改为战术条件，不再随机
    const playerThreats = this.collectThreats(opponent, candidateMoves);
    console.log('[DEBUG] 玩家威胁点数:', playerThreats.length);
    const topThreat = playerThreats[0];

    // 4.1 力拔山兮：高威胁时优先清除十字，且至少打到2子才放
    if (topThreat && this.mp[aiPlayer] >= SKILLS[2].cost) {
      let bestBlast = null;
      let bestImpact = 0;
      const inspectThreats = playerThreats.slice(0, 6);
      for (const threat of inspectThreats) {
        const impact = this.estimateCrossImpact(threat.row, threat.col, opponent);
        if (impact > bestImpact) {
          bestImpact = impact;
          bestBlast = threat;
        }
      }
      if (bestBlast && bestImpact >= 2 && bestBlast.severity >= 120) {
        console.log('[DEBUG] AI战术触发技能2, impact=', bestImpact, ' target=', bestBlast);
        return this.useSkill(2, bestBlast.row, bestBlast.col);
      }
    }

    // 4.2 飞沙走石：高威胁且可迁移敌子时触发
    if (topThreat && this.mp[aiPlayer] >= SKILLS[3].cost && topThreat.severity >= 90) {
      const source = this.findPieceAround(topThreat.row, topThreat.col, opponent);
      const target = this.findLowestThreatEmpty(opponent);
      if (source && target) {
        console.log('[DEBUG] AI战术触发技能3');
        const selectResult = this.useSkill(3, source.row, source.col);
        if (selectResult.success && selectResult.needSecondTarget) {
          return this.useSkill(3, target.row, target.col);
        }
        this.selectedPiece = null;
      }
    }

    // 5. 强制杀棋（VCT/VCF风格）优先，动态提深度
    const killDepth = this.getKillSearchDepth(candidateMoves.length, positionFeatures);
    const forcedKill = this.searchForcedKillMove(aiPlayer, opponent, killDepth, positionFeatures);
    if (forcedKill) {
      console.log('[DEBUG] AI强制杀棋:', forcedKill);
      return this.placeStone(forcedKill.row, forcedKill.col);
    }

    // 6. 对手可能存在强制杀棋时优先拆解其首点
    const opponentKillDepth = Math.max(4, killDepth - 1);
    const opponentKill = this.searchForcedKillMove(opponent, aiPlayer, opponentKillDepth, positionFeatures);
    if (opponentKill && !this.isForbiddenMove(opponentKill.row, opponentKill.col, aiPlayer)) {
      console.log('[DEBUG] AI拆解对手强杀:', opponentKill);
      return this.placeStone(opponentKill.row, opponentKill.col);
    }

    // 7. 搜索下棋（Alpha-Beta）
    const searched = this.searchBestMove(aiPlayer, opponent, positionFeatures);
    if (searched) {
      console.log('[DEBUG] AI搜索选择:', searched);
      return this.placeStone(searched.row, searched.col);
    }

    // 8. 兜底：强化评估
    const fallback = this.pickBestMove(candidateMoves, aiPlayer, opponent);
    if (fallback) {
      console.log('[DEBUG] AI兜底选择:', fallback);
      return this.placeStone(fallback.row, fallback.col);
    }

    console.log('[ERROR] AI找不到合法位置!');
    return { success: false };
  }

  // 寻找威胁点
  findThreats(player) {
    const threats = this.collectThreats(player, this.getCandidateMoves());
    return threats.map(t => ({ row: t.row, col: t.col }));
  }

  // 寻找周围的棋子
  findPieceAround(row, col, player) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const nr = row + i, nc = col + j;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (this.board[nr][nc] === player) {
            return { row: nr, col: nc };
          }
        }
      }
    }
    return null;
  }

  // 选择对指定玩家威胁最小的空位（用于AI技能3转移棋子）
  findLowestThreatEmpty(player) {
    let best = null;
    let minScore = Infinity;
    const moves = this.getCandidateMoves();

    for (const move of moves) {
      const score = this.evaluate(move.row, move.col, player);
      if (score < minScore) {
        minScore = score;
        best = move;
      }
    }

    return best;
  }

  // 评估位置
  evaluate(row, col, player) {
    if (this.board[row][col] !== EMPTY) return -Infinity;

    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    let score = 0;

    this.board[row][col] = player;
    for (const [dr, dc] of dirs) {
      const line = this.countLineInDirection(row, col, player, dr, dc);
      const count = line.count;
      const open = line.openEnds;

      if (count >= 5) score += 100000;
      else if (count === 4 && open === 2) score += 18000;
      else if (count === 4 && open === 1) score += 4000;
      else if (count === 3 && open === 2) score += 1600;
      else if (count === 3 && open === 1) score += 320;
      else if (count === 2 && open === 2) score += 130;
      else if (count === 2 && open === 1) score += 35;
      else if (count === 1 && open === 2) score += 8;
    }
    this.board[row][col] = EMPTY;

    return score;
  }

  // 检查胜利
  // 检查禁手 (仅对黑方)
  hasForbidden(row, col, player, silent = false) {
    // 白方无禁手限制
    if (player === WHITE) return false;

    // 黑方三种禁手:
    // 1. 长连禁手: 6个或以上连续棋子
    // 2. 三三禁手: 同时形成两个活三
    // 3. 四四禁手: 同时形成两个四

    // 检查长连禁手 (6个以上)
    if (this.countLine(row, col, player) >= 6) {
      if (!silent) console.log('[DEBUG] 长连禁手: 6个或以上连续棋子');
      return true;
    }

    // 检查三三禁手和四四禁手
    const patterns = this.getPatterns(row, col, player);
    const threeCount = patterns.filter(p => p === 3).length;
    const fourCount = patterns.filter(p => p === 4).length;

    if (threeCount >= 2) {
      if (!silent) console.log('[DEBUG] 三三禁手: 同时形成两个活三');
      return true;
    }

    if (fourCount >= 2) {
      if (!silent) console.log('[DEBUG] 四四禁手: 同时形成两个四');
      return true;
    }

    return false;
  }

  // 计算指定位置的最长连续棋子数
  countLine(row, col, player) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    let maxCount = 1;

    for (const [dr, dc] of dirs) {
      let count = 1;

      // 正方向
      let i = 1;
      while (this.isValidPos(row + i * dr, col + i * dc) &&
             this.board[row + i * dr][col + i * dc] === player) {
        count++;
        i++;
      }

      // 反方向
      i = 1;
      while (this.isValidPos(row - i * dr, col - i * dc) &&
             this.board[row - i * dr][col - i * dc] === player) {
        count++;
        i++;
      }

      maxCount = Math.max(maxCount, count);
    }

    return maxCount;
  }

  // 获取指定位置周围的所有连线模式 (3或4)
  getPatterns(row, col, player) {
    const patterns = [];
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];

    for (const [dr, dc] of dirs) {
      const line = this.countLineInDirection(row, col, player, dr, dc);

      // 三三仅统计活三（两端都为空）
      if (line.count === 3 && line.openEnds === 2) {
        patterns.push(3);
      }

      // 四四统计可成五的四（至少一端为空）
      if (line.count === 4 && line.openEnds >= 1) {
        patterns.push(4);
      }
    }

    return patterns;
  }

  // 计算指定方向的连续棋子数和开口数
  countLineInDirection(row, col, player, dr, dc) {
    let count = 1;

    // 正方向
    let forwardStep = 1;
    while (this.isValidPos(row + forwardStep * dr, col + forwardStep * dc) &&
           this.board[row + forwardStep * dr][col + forwardStep * dc] === player) {
      count++;
      forwardStep++;
    }

    // 反方向
    let backwardStep = 1;
    while (this.isValidPos(row - backwardStep * dr, col - backwardStep * dc) &&
           this.board[row - backwardStep * dr][col - backwardStep * dc] === player) {
      count++;
      backwardStep++;
    }

    const forwardOpen = this.isValidPos(row + forwardStep * dr, col + forwardStep * dc) &&
      this.board[row + forwardStep * dr][col + forwardStep * dc] === EMPTY;
    const backwardOpen = this.isValidPos(row - backwardStep * dr, col - backwardStep * dc) &&
      this.board[row - backwardStep * dr][col - backwardStep * dc] === EMPTY;

    return {
      count,
      openEnds: (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0)
    };
  }

  checkWin(row, col, player) {
    return !!this.getWinLine(row, col, player);
  }

  getWinLine(row, col, player) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];

    for (const [dr, dc] of dirs) {
      const line = [{ row, col }];

      let i = 1;
      while (this.isValidPos(row + i * dr, col + i * dc) &&
             this.board[row + i * dr][col + i * dc] === player) {
        line.push({ row: row + i * dr, col: col + i * dc });
        i++;
      }

      i = 1;
      while (this.isValidPos(row - i * dr, col - i * dc) &&
             this.board[row - i * dr][col - i * dc] === player) {
        line.unshift({ row: row - i * dr, col: col - i * dc });
        i++;
      }

      if (line.length >= 5) {
        return line;
      }
    }

    return null;
  }

  // 检查位置有效性
  isValidPos(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  // 重置游戏
  reset() {
    this.board = this.initBoard();
    this.turn = BLACK;
    this.mp = { [BLACK]: 30, [WHITE]: 30 };
    this.gameOver = false;
    this.winner = null;
    this.moveCount = 0;
    this.currentSkill = null;
    this.extraTurns = 0;
    this.transpositionTable.clear();
    this.historyHeuristic.clear();
    this.killerMoves.clear();
    this.vctTranspositionLayers.clear();
    this.currentSearchFeatures = null;
  }

  // 获取游戏状态
  getState() {
    return {
      board: this.board.map(row => [...row]),
      turn: this.turn,
      mp: { ...this.mp },
      gameOver: this.gameOver,
      winner: this.winner,
      currentSkill: this.currentSkill,
      extraTurns: this.extraTurns,
      skills: SKILLS
    };
  }
}

module.exports = {
  SkillGomoku,
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  SKILLS
};
