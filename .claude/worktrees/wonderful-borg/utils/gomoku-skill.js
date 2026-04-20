/**
 * 技能五子棋游戏逻辑 - 诸神之战
 */

const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;  // 玩家（侠客）
const WHITE = 2;  // AI（魔头）

// 技能定义
const SKILLS = {
  1: { name: '时光倒流', cost: 30, desc: '悔棋一步,撤销上一步操作' },
  2: { name: '力拔山兮', cost: 50, desc: '炸毁十字范围内的所有棋子' },
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
    const hasWon = this.checkWin(row, col, this.turn);
    if (hasWon) {
      this.gameOver = true;
      this.winner = this.turn;
      console.log('[DEBUG] 游戏结束,胜者:', this.winner);

      // 如果同时满足禁手条件，但形成5连，则按5连胜处理
      return { success: true, gameOver: true, winner: this.turn };
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
    if (!skill || this.mp[this.turn] < skill.cost) {
      return { success: false, message: '无法使用技能' };
    }

    // 扣除内力
    this.mp[this.turn] -= skill.cost;

    let effect = { skillId, skillName: skill.name };

    if (skillId === 1) {
      // 技能1: 时光倒流 - 悔棋一步
      console.log('[DEBUG] 技能1: 悔棋, 历史记录数:', this.moveHistory.length);

      if (this.moveHistory.length === 0) {
        // 退还内力
        this.mp[this.turn] += skill.cost;
        return { success: false, message: '没有可以悔棋的步数！' };
      }

      // 撤销最后一步
      const lastMove = this.moveHistory.pop();
      this.board[lastMove.row][lastMove.col] = EMPTY;
      this.moveCount--;

      effect.type = 'undo';
      effect.position = { row: lastMove.row, col: lastMove.col };
      console.log('[DEBUG] 悔棋成功,撤销:', lastMove);

      // 技能1使用后需要切换回合
      this.switchTurn();
      this.currentSkill = null;
      return { success: true, effect };

    } else if (skillId === 2) {
      // 技能2: 力拔山兮 - 炸毁十字范围
      console.log('[DEBUG] 技能2: 炸毁十字, 中心:', row, col);

      const positions = [];
      // 十字方向: 上下左右各2格+中心
      const directions = [
        [0, 0],   // 中心
        [-1, 0], [1, 0],   // 上下
        [0, -1], [0, 1],   // 左右
        [-2, 0], [2, 0],   // 上下延伸
        [0, -2], [0, 2]    // 左右延伸
      ];

      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (this.board[nr][nc] !== EMPTY) {
            this.board[nr][nc] = EMPTY;
            positions.push({ row: nr, col: nc });
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
        return { success: true, needSecondTarget: true, effect: { skillId, skillName: skill.name, type: 'select' } };

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
        console.log('[DEBUG] 移动完成:', effect.from, '→', effect.to);

        this.selectedPiece = null;
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

      this.board = this.initBoard();
      this.moveCount = 0;
      this.moveHistory = [];
      effect.type = 'reset';

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

  // AI 下棋
  aiMove() {
    console.log('[DEBUG] aiMove 开始: turn=', this.turn, 'gameOver=', this.gameOver);

    if (this.gameOver || this.turn !== WHITE) {
      console.log('[DEBUG] aiMove 被阻止');
      return { success: false };
    }

    // AI 技能逻辑
    const playerThreats = this.findThreats(BLACK);
    console.log('[DEBUG] 玩家威胁点数:', playerThreats.length);

    // 60%概率使用技能3（静如止水）- 3x3范围清除
    if (this.mp[WHITE] >= 85 && playerThreats.length > 0 && Math.random() > 0.4) {
      const threat = playerThreats[0];
      console.log('[DEBUG] AI使用技能3');
      return this.useSkill(3, threat.row, threat.col);
    }

    // 50%概率使用技能2（飞沙走石）- 策反敌子
    if (this.mp[WHITE] >= 70 && playerThreats.length > 0 && Math.random() > 0.5) {
      const target = this.findPieceAround(playerThreats[0].row, playerThreats[0].col, BLACK);
      if (target) {
        console.log('[DEBUG] AI使用技能2');
        return this.useSkill(2, target.row, target.col);
      }
    }

    // 40%概率使用技能1（时光倒流）- 移除玩家棋子
    if (this.mp[WHITE] >= 30 && playerThreats.length > 0 && Math.random() > 0.6) {
      const target = this.findPieceAround(playerThreats[0].row, playerThreats[0].col, BLACK);
      if (target) {
        console.log('[DEBUG] AI使用技能1');
        return this.useSkill(1, target.row, target.col);
      }
    }

    // 普通下棋
    console.log('[DEBUG] AI普通下棋...');
    let best = null;
    let maxScore = -1;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] === EMPTY) {
          const score = this.evaluate(r, c, WHITE) + this.evaluate(r, c, BLACK) * 1.2;
          if (score > maxScore) {
            maxScore = score;
            best = { row: r, col: c };
          }
        }
      }
    }

    if (best) {
      console.log('[DEBUG] AI选择位置:', best);
      return this.placeStone(best.row, best.col);
    }

    console.log('[ERROR] AI找不到合法位置!');
    return { success: false };
  }

  // 寻找威胁点
  findThreats(player) {
    const threats = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] === EMPTY && this.evaluate(r, c, player) > 2000) {
          threats.push({ row: r, col: c });
        }
      }
    }
    return threats;
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

  // 评估位置
  evaluate(row, col, player) {
    let score = 0;
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
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
      
      if (count >= 5) score += 10000;
      else if (count === 4) score += 1000;
      else if (count === 3) score += 100;
      else if (count === 2) score += 10;
    }
    
    return score;
  }

  // 检查胜利
  // 检查禁手 (仅对黑方)
  hasForbidden(row, col, player) {
    // 白方无禁手限制
    if (player === WHITE) return false;

    // 黑方三种禁手:
    // 1. 长连禁手: 6个或以上连续棋子
    // 2. 三三禁手: 同时形成两个活三
    // 3. 四四禁手: 同时形成两个四

    // 检查长连禁手 (6个以上)
    if (this.countLine(row, col, player) >= 6) {
      console.log('[DEBUG] 长连禁手: 6个或以上连续棋子');
      return true;
    }

    // 检查三三禁手和四四禁手
    const patterns = this.getPatterns(row, col, player);
    const threeCount = patterns.filter(p => p === 3).length;
    const fourCount = patterns.filter(p => p === 4).length;

    if (threeCount >= 2) {
      console.log('[DEBUG] 三三禁手: 同时形成两个活三');
      return true;
    }

    if (fourCount >= 2) {
      console.log('[DEBUG] 四四禁手: 同时形成两个四');
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
      const count = this.countLineInDirection(row, col, player, dr, dc);
      if (count === 3 || count === 4) {
        patterns.push(count);
      }
    }

    return patterns;
  }

  // 计算指定方向的连续棋子数
  countLineInDirection(row, col, player, dr, dc) {
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

    return count;
  }

  checkWin(row, col, player) {
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
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
      
      if (count >= 5) return true;
    }
    
    return false;
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
