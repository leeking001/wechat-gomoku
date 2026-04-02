const { Gomoku, BOARD_SIZE, BLACK, WHITE } = require('../../utils/gomoku');

Page({
  data: {
    boardSize: BOARD_SIZE,
    board: [],
    gameStarted: false,
    gameOver: false,
    winner: null,
    currentPlayer: BLACK,
    aiThinking: false,
    moveHistory: [],
    stats: {
      wins: 0,
      losses: 0,
      draws: 0
    }
  },

  onLoad() {
    this.initGame();
    this.loadStats();
  },

  /**
   * 初始化游戏
   */
  initGame() {
    this.gomoku = new Gomoku();
    this.setData({
      board: this.gomoku.getBoard(),
      gameStarted: true,
      gameOver: false,
      winner: null,
      currentPlayer: BLACK,
      moveHistory: [],
      aiThinking: false
    });
  },

  /**
   * 处理棋盘点击
   */
  onBoardClick(e) {
    if (this.data.gameOver || this.data.aiThinking) return;

    const { x, y } = e.detail;
    const cellSize = e.currentTarget.dataset.cellSize || 25;

    const col = Math.round(x / cellSize);
    const row = Math.round(y / cellSize);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return;
    }

    // 玩家下棋
    if (!this.gomoku.placeStone(row, col, BLACK)) {
      wx.showToast({
        title: '该位置已有棋子',
        icon: 'error',
        duration: 1500
      });
      return;
    }

    this.updateBoard();

    // 检查玩家是否赢
    if (this.gomoku.gameOver) {
      this.endGame(BLACK);
      return;
    }

    // AI 下棋
    this.setData({ aiThinking: true });
    setTimeout(() => {
      this.aiMove();
    }, 500);
  },

  /**
   * AI 下棋
   */
  aiMove() {
    if (!this.gomoku.aiMove()) {
      wx.showToast({
        title: '游戏结束',
        icon: 'success'
      });
      this.endGame(null);
      return;
    }

    this.updateBoard();

    // 检查 AI 是否赢
    if (this.gomoku.gameOver) {
      this.endGame(WHITE);
      return;
    }

    this.setData({ aiThinking: false });
  },

  /**
   * 更新棋盘显示
   */
  updateBoard() {
    this.setData({
      board: this.gomoku.getBoard(),
      moveHistory: this.getMoveHistory()
    });
  },

  /**
   * 获取移动历史
   */
  getMoveHistory() {
    const history = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.gomoku.board[i][j] !== 0) {
          history.push({
            row: i,
            col: j,
            color: this.gomoku.board[i][j]
          });
        }
      }
    }
    return history;
  },

  /**
   * 游戏结束
   */
  endGame(winner) {
    this.setData({
      gameOver: true,
      winner: winner,
      aiThinking: false
    });

    // 更新统计
    if (winner === BLACK) {
      this.data.stats.wins++;
      wx.showToast({
        title: '恭喜！你赢了！',
        icon: 'success',
        duration: 2000
      });
    } else if (winner === WHITE) {
      this.data.stats.losses++;
      wx.showToast({
        title: 'AI 赢了！',
        icon: 'error',
        duration: 2000
      });
    } else {
      this.data.stats.draws++;
      wx.showToast({
        title: '平局',
        icon: 'success',
        duration: 2000
      });
    }

    this.saveStats();
  },

  /**
   * 重新开始游戏
   */
  onRestart() {
    this.initGame();
  },

  /**
   * 悔棋
   */
  onUndo() {
    if (this.data.moveHistory.length < 2) {
      wx.showToast({
        title: '无法悔棋',
        icon: 'error'
      });
      return;
    }

    // 简单实现：重新开始游戏
    wx.showModal({
      title: '确认',
      content: '悔棋功能开发中，是否重新开始？',
      success: (res) => {
        if (res.confirm) {
          this.initGame();
        }
      }
    });
  },

  /**
   * 保存统计数据
   */
  saveStats() {
    wx.setStorageSync('gomokuStats', this.data.stats);
  },

  /**
   * 加载统计数据
   */
  loadStats() {
    const stats = wx.getStorageSync('gomokuStats');
    if (stats) {
      this.setData({ stats });
    }
  },

  /**
   * 查看规则
   */
  onShowRules() {
    wx.showModal({
      title: '游戏规则',
      content: '五子棋规则：\n\n1. 黑棋先手（你是黑棋）\n2. 轮流在棋盘上放置棋子\n3. 先连成5个同色棋子（横、竖、斜）即为获胜\n4. 如果棋盘满了还没有人赢，则为平局',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 分享游戏
   */
  onShare() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  }
});
