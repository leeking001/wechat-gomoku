/**
 * 五子棋游戏逻辑
 */

const BOARD_SIZE = 15; // 棋盘大小
const EMPTY = 0;       // 空位
const BLACK = 1;       // 黑棋（玩家）
const WHITE = 2;       // 白棋（AI）

class Gomoku {
  constructor() {
    this.board = this.initBoard();
    this.gameOver = false;
    this.winner = null;
    this.moveCount = 0;
  }

  /**
   * 初始化棋盘
   */
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

  /**
   * 放置棋子
   */
  placeStone(row, col, color) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return false;
    }
    if (this.board[row][col] !== EMPTY) {
      return false;
    }

    this.board[row][col] = color;
    this.moveCount++;

    // 检查是否游戏结束
    if (this.checkWin(row, col, color)) {
      this.gameOver = true;
      this.winner = color;
    }

    return true;
  }

  /**
   * 检查是否胜利
   */
  checkWin(row, col, color) {
    const directions = [
      { dx: 1, dy: 0 },   // 水平
      { dx: 0, dy: 1 },   // 竖直
      { dx: 1, dy: 1 },   // 对角线 \
      { dx: 1, dy: -1 }   // 对角线 /
    ];

    for (let { dx, dy } of directions) {
      let count = 1;

      // 正方向
      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
          count++;
        } else {
          break;
        }
      }

      // 反方向
      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查位置是否有效
   */
  isValidPos(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  /**
   * AI 下棋 - 简单策略
   */
  aiMove() {
    if (this.gameOver) return false;

    // 获取可用移动
    const availableMoves = this.getAvailableMoves();
    if (availableMoves.length === 0) return false;

    // 优先考虑能赢的移动
    for (let move of availableMoves) {
      if (this.wouldWin(move.row, move.col, WHITE)) {
        return this.placeStone(move.row, move.col, WHITE);
      }
    }

    // 其次考虑防守
    for (let move of availableMoves) {
      if (this.wouldWin(move.row, move.col, BLACK)) {
        return this.placeStone(move.row, move.col, WHITE);
      }
    }

    // 倾向于中心位置
    const bestMove = this.findBestMove(availableMoves);
    return this.placeStone(bestMove.row, bestMove.col, WHITE);
  }

  /**
   * 获取所有可用的移动
   */
  getAvailableMoves() {
    const moves = [];
    const searchRadius = 2;

    if (this.moveCount === 0) {
      // 第一步落在中心
      return [{ row: 7, col: 7, score: 0 }];
    }

    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.board[i][j] === EMPTY && this.hasNeighbor(i, j, searchRadius)) {
          moves.push({ row: i, col: j, score: this.evaluatePosition(i, j) });
        }
      }
    }

    // 按评分排序，返回最好的20个
    return moves.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * 检查位置是否有邻近棋子
   */
  hasNeighbor(row, col, radius) {
    for (let i = Math.max(0, row - radius); i <= Math.min(BOARD_SIZE - 1, row + radius); i++) {
      for (let j = Math.max(0, col - radius); j <= Math.min(BOARD_SIZE - 1, col + radius); j++) {
        if (this.board[i][j] !== EMPTY) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 评估位置价值
   */
  evaluatePosition(row, col) {
    let score = 0;

    // 中心位置更有价值
    const centerDist = Math.abs(row - 7) + Math.abs(col - 7);
    score += (14 - centerDist) * 10;

    // 评估各方向的连续性
    const directions = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];

    for (let { dx, dy } of directions) {
      score += this.countDirection(row, col, dx, dy, BLACK) * 5;
      score += this.countDirection(row, col, dx, dy, WHITE) * 8;
    }

    return score;
  }

  /**
   * 计算某方向的连续同色棋子数
   */
  countDirection(row, col, dx, dy, color) {
    let count = 0;

    // 正方向
    for (let i = 1; i < 5; i++) {
      const newRow = row + dx * i;
      const newCol = col + dy * i;
      if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
        count++;
      } else {
        break;
      }
    }

    // 反方向
    for (let i = 1; i < 5; i++) {
      const newRow = row - dx * i;
      const newCol = col - dy * i;
      if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * 检查某步是否能赢
   */
  wouldWin(row, col, color) {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 }
    ];

    for (let { dx, dy } of directions) {
      let count = 1;

      for (let i = 1; i < 5; i++) {
        const newRow = row + dx * i;
        const newCol = col + dy * i;
        if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
          count++;
        } else {
          break;
        }
      }

      for (let i = 1; i < 5; i++) {
        const newRow = row - dx * i;
        const newCol = col - dy * i;
        if (this.isValidPos(newRow, newCol) && this.board[newRow][newCol] === color) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 5) {
        return true;
      }
    }

    return false;
  }

  /**
   * 寻找最佳移动
   */
  findBestMove(moves) {
    return moves.length > 0 ? moves[0] : { row: 7, col: 7 };
  }

  /**
   * 重置游戏
   */
  reset() {
    this.board = this.initBoard();
    this.gameOver = false;
    this.winner = null;
    this.moveCount = 0;
  }

  /**
   * 获取棋盘副本
   */
  getBoard() {
    return this.board.map(row => [...row]);
  }
}

module.exports = {
  Gomoku,
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE
};
