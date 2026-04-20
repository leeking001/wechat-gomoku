const { SkillGomoku, BOARD_SIZE, BLACK, WHITE, SKILLS } = require('./utils/gomoku-skill');
const { GAME_GUIDE } = require('./utils/guide');

// 游戏常量
const CELL_SIZE = 22;
const PADDING = 15;
const BOARD_SIZE_PX = BOARD_SIZE * CELL_SIZE + 2 * PADDING;

// 全局游戏状态
let game = null;
let gameState = {
  turn: BLACK,
  playerMp: 30,
  aiMp: 30,
  currentSkill: null,
  skillDesc: '静待时机...',
  message: '',
  messageColor: '#ffd700',
  showMessage: false,
  gameOver: false,
  showGuide: false,
  guideScroll: 0
};

let canvas = null;
let ctx = null;
let skillButtons = [];
let musicPlaying = true;
let soundEnabled = true;
let boardRect = null; // 用于存储棋盘位置
let aiThinking = false; // 防止AI重复思考

// 触摸跟踪 - 用于说明书滚动
let touchStartY = 0;
let touchStartGuideScroll = 0;

// 音频上下文
let bgMusic = null; // 背景音乐
let soundEffects = {}; // 音效集合

// 音效管理
const audioManager = {
  musicEnabled: true,
  soundEnabled: true,
  bgMusicContext: null,
  soundContexts: {},
  musicStarted: false,

  // 初始化背景音乐 - 使用中文古筝音乐
  initMusic() {
    if (!this.bgMusicContext) {
      try {
        this.bgMusicContext = wx.createInnerAudioContext();
        this.bgMusicContext.loop = true;
        this.bgMusicContext.volume = 0.4;
        // 使用中文古筝背景音乐 (类似原项目的方式)
        this.bgMusicContext.src = 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3?filename=chinese-fantasy-guzheng-126666.mp3';
        console.log('[DEBUG] 背景音乐初始化完成 (URL模式)');
      } catch (e) {
        console.log('[ERROR] 音乐初始化失败:', e);
      }
    }
  },

  // 初始化所有音效
  initSounds() {
    const soundFiles = {
      'click': 'sounds/click.wav',
      'place': 'sounds/place.wav',
      'skill': 'sounds/skill.wav',
      'win': 'sounds/win.wav',
      'lose': 'sounds/lose.wav'
    };

    for (const [type, path] of Object.entries(soundFiles)) {
      try {
        if (!this.soundContexts[type]) {
          this.soundContexts[type] = wx.createInnerAudioContext();
          this.soundContexts[type].volume = 0.5;
          this.soundContexts[type].src = path;
        }
      } catch (e) {
        console.log(`[ERROR] 音效 ${type} 初始化失败:`, e);
      }
    }
    console.log('[DEBUG] 所有音效初始化完成');
  },

  // 播放音效
  playSound(type) {
    if (!this.soundEnabled) return;

    try {
      // 首先尝试播放真实音频
      if (this.soundContexts[type]) {
        // 重置音频位置并播放
        this.soundContexts[type].seek(0);
        this.soundContexts[type].play().catch(err => {
          console.log(`[WARN] 音效播放失败 ${type}:`, err);
          // 降级到振动反馈
          this.playVibration(type);
        });
      } else {
        // 没有该音效,使用振动反馈
        this.playVibration(type);
      }
    } catch (e) {
      console.log('[ERROR] 音效播放异常:', e);
      this.playVibration(type);
    }
  },

  // 振动反馈(作为音效的备选方案)
  playVibration(type) {
    try {
      switch (type) {
        case 'click':
          wx.vibrateShort({ type: 'light' });
          break;
        case 'place':
          wx.vibrateShort({ type: 'medium' });
          break;
        case 'skill':
          wx.vibrateShort({ type: 'heavy' });
          setTimeout(() => {
            wx.vibrateShort({ type: 'medium' });
          }, 100);
          break;
        case 'win':
          wx.vibrateShort({ type: 'heavy' });
          setTimeout(() => {
            wx.vibrateShort({ type: 'heavy' });
            setTimeout(() => {
              wx.vibrateShort({ type: 'heavy' });
            }, 150);
          }, 150);
          break;
        case 'lose':
          wx.vibrateLong({});
          break;
      }
    } catch (e) {
      console.log('[ERROR] 振动反馈异常:', e);
    }
  },

  // 切换音乐
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;

    if (this.musicEnabled) {
      // 开启音乐
      try {
        if (this.bgMusicContext) {
          this.bgMusicContext.play();
          this.musicStarted = true;
          console.log('[INFO] 音乐已开启');
        }
      } catch (e) {
        console.log('[WARN] 音乐播放失败:', e);
      }
      this.playVibration('click');
    } else {
      // 关闭音乐
      try {
        if (this.bgMusicContext) {
          this.bgMusicContext.pause();
          console.log('[INFO] 音乐已关闭');
        }
      } catch (e) {
        console.log('[WARN] 音乐暂停失败:', e);
      }
      this.playVibration('click');
    }

    return this.musicEnabled;
  },

  // 切换音效
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    console.log(this.soundEnabled ? '[INFO] 音效已开启' : '[INFO] 音效已关闭');
    if (this.soundEnabled) {
      this.playVibration('click');
    }
    return this.soundEnabled;
  }
};

const sysInfo = wx.getSystemInfoSync();
const SCREEN_WIDTH = sysInfo.windowWidth;
const SCREEN_HEIGHT = sysInfo.windowHeight;
const PIXEL_RATIO = sysInfo.pixelRatio || 2; // 设备像素比(iPhone通常是2或3)

console.log('[DEBUG] 屏幕信息:', {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  pixelRatio: PIXEL_RATIO,
  statusBarHeight: sysInfo.statusBarHeight
});

// 获取安全区域 - 避免被刘海屏/状态栏遮挡
const STATUS_BAR_HEIGHT = sysInfo.statusBarHeight || 20;
const SAFE_AREA_TOP = STATUS_BAR_HEIGHT + 10; // 状态栏高度 + 10px 间距

// 获取微信胶囊按钮的位置信息
const menuButtonInfo = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
console.log('[DEBUG] 胶囊按钮信息:', menuButtonInfo);

// 计算按钮安全区域(避开胶囊)
const BUTTON_SAFE_RIGHT = menuButtonInfo ? menuButtonInfo.left - 10 : SCREEN_WIDTH - 10; // 胶囊左边界 - 10px间距

// UI 尺寸
const TOP_BAR_HEIGHT = 80;
const AI_INFO_HEIGHT = 80;
const BOARD_MARGIN = 12;
const SKILL_BAR_HEIGHT = 120;
const PLAYER_INFO_HEIGHT = 80;

// 颜色定义
const COLORS = {
  bg: '#1a1a1a',
  boardBg: '#0f1419',
  boardFrame: '#d4a574',
  boardGrid: '#8b7355',
  skill1: '#e74c3c',
  skill2: '#2ecc71',
  skill3: '#f39c12',
  skill4: '#3498db',
  skill5: '#9b59b6',
  gold: '#d4a574',
  white: '#ffffff',
  text: '#ecf0f1'
};

// 技能信息
const SKILL_INFO = {
  1: { name: '时光倒流', cost: 30, icon: '⏳' },
  2: { name: '力拔山兮', cost: 50, icon: '💪' },
  3: { name: '飞沙走石', cost: 70, icon: '💨' },
  4: { name: '静如止水', cost: 100, icon: '💧' },
  5: { name: '东山再起', cost: 200, icon: '🔥' }
};

// 初始化游戏
function initGame() {
  // 初始化音效
  audioManager.initMusic();
  audioManager.initSounds();

  // 尝试自动启动背景音乐 (需要用户交互)
  try {
    if (audioManager.bgMusicContext && audioManager.musicEnabled) {
      audioManager.bgMusicContext.play().catch(err => {
        // 微信小游戏需要用户交互才能播放音乐
        console.log('[WARN] 背景音乐需要用户交互后才能播放:', err);
      });
    }
  } catch (e) {
    console.log('[ERROR] 启动背景音乐异常:', e);
  }

  // 完全重置游戏状态
  game = new SkillGomoku();
  boardRect = null;
  skillButtons = [];
  aiThinking = false; // 重置AI思考标志

  gameState = {
    turn: BLACK,
    playerMp: 0,  // 开局内力为0
    aiMp: 0,      // 开局内力为0
    currentSkill: null,
    skillDesc: '静待时机...',
    message: '',
    messageColor: '#ffd700',
    showMessage: false,
    gameOver: false,
    showGuide: false,
    guideScroll: 0
  };

  // 确保 game 对象也是完全重置的状态
  game.turn = BLACK;
  game.gameOver = false;
  game.winner = null;
  game.mp[BLACK] = 0;
  game.mp[WHITE] = 0;
  game.currentSkill = null;
  game.extraTurns = 0;
  game.moveCount = 0;

  // 只在第一次初始化时创建 canvas
  if (!canvas) {
    canvas = wx.createCanvas();
    ctx = canvas.getContext('2d');

    // 设置高清屏支持
    // 物理像素 = 逻辑像素 × pixelRatio
    canvas.width = SCREEN_WIDTH * PIXEL_RATIO;
    canvas.height = SCREEN_HEIGHT * PIXEL_RATIO;

    // 缩放绘图上下文,使得绘图代码可以使用逻辑像素
    ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

    console.log('[DEBUG] Canvas已创建:', {
      logicalSize: `${SCREEN_WIDTH}×${SCREEN_HEIGHT}`,
      physicalSize: `${canvas.width}×${canvas.height}`,
      ratio: PIXEL_RATIO
    });
  }

  // 清空画布
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawGame();
  showGameMessage('江湖路远 请赐教', '#d4a574');
}

// 绘制整个游戏
function drawGame() {
  // 清空画布
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // 如果显示说明书，只绘制说明书
  if (gameState.showGuide) {
    drawGuide();
    return;
  }

  // 绘制各部分
  drawTopBar();
  drawAIInfo();
  drawBoardArea();
  drawPlayerInfo();
  drawSkillBar();

  // 绘制游戏消息
  if (gameState.showMessage) {
    drawMessage();
  }
}

// 绘制顶部栏
function drawTopBar() {
  const y = SAFE_AREA_TOP; // 使用安全区域顶部
  const height = TOP_BAR_HEIGHT - 20;

  // 背景
  ctx.fillStyle = 'rgba(52, 73, 94, 0.3)';
  ctx.fillRect(BOARD_MARGIN, y, SCREEN_WIDTH - 2 * BOARD_MARGIN, height);

  // 标题 - 在整个屏幕居中
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 22px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('真技能五子棋', SCREEN_WIDTH / 2, y + 20);
}

// 绘制AI信息栏
function drawAIInfo() {
  const y = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20; // 调整位置,基于新的顶部栏位置
  const height = AI_INFO_HEIGHT;
  const padding = 12;

  // 背景框
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_MARGIN, y, SCREEN_WIDTH - 2 * BOARD_MARGIN, height);

  ctx.fillStyle = 'rgba(212, 165, 116, 0.1)';
  ctx.fillRect(BOARD_MARGIN, y, SCREEN_WIDTH - 2 * BOARD_MARGIN, height);

  // AI 头像和信息
  const avatarX = BOARD_MARGIN + padding;
  const avatarSize = height - 2 * padding;

  // 头像背景
  ctx.fillStyle = COLORS.skill1;
  ctx.fillRect(avatarX, y + padding, avatarSize, avatarSize);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(avatarX, y + padding, avatarSize, avatarSize);

  // 头像
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👹', avatarX + avatarSize / 2, y + padding + avatarSize / 2);

  // AI 名称和状态
  const infoX = avatarX + avatarSize + 12;
  const infoY = y + padding + 8;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 16px SimHei, Arial';
  ctx.fillText('魔头（AI）', infoX, infoY);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px Arial';
  ctx.fillText(gameState.turn === WHITE ? '行动中' : '待命中', infoX, infoY + 20);

  // MP 条
  const barX = infoX;
  const barY = infoY + 32;
  const btnAreaWidth = 70; // 为右侧按钮预留空间
  const barWidth = SCREEN_WIDTH - 2 * BOARD_MARGIN - (infoX - BOARD_MARGIN) - padding - btnAreaWidth;
  const barHeight = 12;

  // 背景条
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // MP 条
  const mpPercent = gameState.aiMp / 200; // 上限改为200
  ctx.fillStyle = COLORS.skill1;
  ctx.fillRect(barX, barY, barWidth * mpPercent, barHeight);

  // 边框
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // MP 文字
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(gameState.aiMp + ' / 200', barX + barWidth - 4, barY + 10); // 上限改为200

  // 音乐和说明按钮 - 放在AI面板右上角
  const btnSize = 28;
  const btnSpacing = 6;
  const btnAreaX = SCREEN_WIDTH - BOARD_MARGIN - btnAreaWidth + 6;
  const btnY = y + padding;

  // 音乐按钮
  const musicBtnX = btnAreaX;
  drawButton('🎵', musicBtnX, btnY, btnSize, btnSize, musicPlaying ? COLORS.skill4 : COLORS.text);

  // 说明按钮
  const guideBtnX = musicBtnX + btnSize + btnSpacing;
  drawButton('?', guideBtnX, btnY, btnSize, btnSize, COLORS.gold);
}

// 绘制棋盘区域
function drawBoardArea() {
  const topMargin = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN; // 调整基于安全区域
  const boardX = (SCREEN_WIDTH - BOARD_SIZE_PX) / 2;
  const boardY = topMargin;

  // 外框（金色）
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(boardX - 6, boardY - 6, BOARD_SIZE_PX + 12, BOARD_SIZE_PX + 12);

  // 棋盘背景
  ctx.fillStyle = '#eebb77';
  ctx.fillRect(boardX, boardY, BOARD_SIZE_PX, BOARD_SIZE_PX);

  // 网格线
  ctx.strokeStyle = COLORS.boardGrid;
  ctx.lineWidth = 1;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = boardX + PADDING + i * CELL_SIZE;
    const y = boardY + PADDING + i * CELL_SIZE;

    // 竖线
    ctx.beginPath();
    ctx.moveTo(x, boardY + PADDING);
    ctx.lineTo(x, boardY + PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
    ctx.stroke();

    // 横线
    ctx.beginPath();
    ctx.moveTo(boardX + PADDING, y);
    ctx.lineTo(boardX + PADDING + (BOARD_SIZE - 1) * CELL_SIZE, y);
    ctx.stroke();
  }

  // 星位
  ctx.fillStyle = '#2c3e50';
  [3, 7, 11].forEach(pos => {
    [3, 7, 11].forEach(p => {
      ctx.beginPath();
      ctx.arc(boardX + PADDING + p * CELL_SIZE, boardY + PADDING + pos * CELL_SIZE, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  });

  // 绘制棋子
  const board = game.board;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) {
        drawPiece(r, c, board[r][c], boardX, boardY);
      }
    }
  }

  // 保存棋盘位置用于点击检测
  boardRect = {
    x: boardX,
    y: boardY,
    size: BOARD_SIZE_PX
  };
}

// 绘制棋子
function drawPiece(row, col, type, boardX, boardY) {
  const x = boardX + PADDING + col * CELL_SIZE;
  const y = boardY + PADDING + row * CELL_SIZE;
  const radius = 10;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);

  if (type === BLACK) {
    ctx.fillStyle = '#111';
  } else {
    ctx.fillStyle = '#fff';
  }

  ctx.fill();

  // 边框
  ctx.strokeStyle = type === BLACK ? '#555' : '#ddd';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// 绘制玩家信息栏
function drawPlayerInfo() {
  const boardTop = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN; // 调整基于安全区域
  const boardY = boardTop + BOARD_SIZE_PX + BOARD_MARGIN;
  const height = PLAYER_INFO_HEIGHT;

  // 提示文字
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.turn === BLACK ? '[你] 侠客 行动中' : '[T1] 魔头 落子 (' + 7 + ',' + 7 + ')', SCREEN_WIDTH / 2, boardY + 12);

  ctx.fillStyle = COLORS.gold;
  ctx.font = '12px SimHei, Arial';
  ctx.fillText('请落子（黑方有禁手）', SCREEN_WIDTH / 2, boardY + 32);

  // 玩家面板
  const panelY = boardY + 45;
  const panelHeight = height - 45;

  // 背景框
  ctx.strokeStyle = COLORS.skill2;
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_MARGIN, panelY, SCREEN_WIDTH - 2 * BOARD_MARGIN, panelHeight);

  ctx.fillStyle = 'rgba(46, 204, 113, 0.1)';
  ctx.fillRect(BOARD_MARGIN, panelY, SCREEN_WIDTH - 2 * BOARD_MARGIN, panelHeight);

  // 玩家信息
  const padding = 10;
  const infoX = BOARD_MARGIN + padding;
  const infoY = panelY + padding;

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 14px SimHei, Arial';
  ctx.textAlign = 'left';
  ctx.fillText('玩家（你）', infoX, infoY + 12);

  // MP 条
  const barX = infoX + 80;
  const barY = infoY + 5;
  const barWidth = SCREEN_WIDTH - 2 * BOARD_MARGIN - (barX - BOARD_MARGIN) - padding;
  const barHeight = 10;

  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const mpPercent = gameState.playerMp / 200; // 上限改为200
  ctx.fillStyle = COLORS.skill2;
  ctx.fillRect(barX, barY, barWidth * mpPercent, barHeight);

  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(gameState.playerMp + ' / 200', barX + barWidth - 4, barY + 8); // 上限改为200

  // 技能锁定状态
  if (gameState.currentSkill) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('已激活技能：' + SKILL_INFO[gameState.currentSkill].name, infoX, infoY + 28);
  }
}

// 绘制技能栏
function drawSkillBar() {
  const y = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN + BOARD_SIZE_PX + BOARD_MARGIN + PLAYER_INFO_HEIGHT + BOARD_MARGIN; // 调整基于安全区域
  const height = SKILL_BAR_HEIGHT;

  // 背景
  ctx.fillStyle = COLORS.boardBg;
  ctx.fillRect(0, y, SCREEN_WIDTH, height);

  // 技能按钮
  skillButtons = [];
  const skillCount = 5;
  const buttonWidth = (SCREEN_WIDTH - 2 * BOARD_MARGIN - (skillCount - 1) * 6) / skillCount;
  const buttonHeight = 100;
  const startX = BOARD_MARGIN;
  const buttonY = y + (height - buttonHeight) / 2;

  for (let i = 1; i <= skillCount; i++) {
    const skill = SKILLS[i] || SKILL_INFO[i];
    const x = startX + (i - 1) * (buttonWidth + 6);

    const canUse = gameState.playerMp >= skill.cost && gameState.turn === BLACK && !gameState.gameOver;
    const isActive = gameState.currentSkill === i;

    drawSkillButton(i, x, buttonY, buttonWidth, buttonHeight, canUse, isActive, skill);

    skillButtons.push({
      id: i,
      x: x,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    });
  }
}

// 绘制技能按钮
function drawSkillButton(id, x, y, w, h, canUse, isActive, skill) {
  const info = SKILL_INFO[id];
  const color = [COLORS.skill1, COLORS.skill2, COLORS.skill3, COLORS.skill4, COLORS.skill5][id - 1];

  // 背景
  if (isActive) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
  } else if (canUse) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
  } else {
    ctx.fillStyle = '#555';
    ctx.globalAlpha = 0.2;
  }

  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  // 边框
  ctx.strokeStyle = isActive ? '#fff' : color;
  ctx.lineWidth = isActive ? 3 : 2;
  ctx.strokeRect(x, y, w, h);

  // 图标
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(info.icon, x + w / 2, y + 8);

  // 技能名称
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(info.name, x + w / 2, y + 36);

  // 消耗
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 10px Arial';
  ctx.fillText(info.cost, x + w / 2, y + 53);

  // 状态
  ctx.fillStyle = canUse ? COLORS.skill2 : '#999';
  ctx.font = '9px Arial';
  ctx.fillText(canUse ? '可用' : '不可用', x + w / 2, y + 70);
}

// 绘制按钮
function drawButton(text, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = color;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

// 绘制消息
function drawMessage() {
  const messageY = SCREEN_HEIGHT / 2;

  // 半透明背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, messageY - 50, SCREEN_WIDTH, 100);

  // 文字
  ctx.fillStyle = gameState.messageColor;
  ctx.font = 'bold 36px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(gameState.message, SCREEN_WIDTH / 2, messageY + 5);
}

// 显示游戏消息
function showGameMessage(text, color) {
  gameState.message = text;
  gameState.messageColor = color;
  gameState.showMessage = true;

  drawGame();

  setTimeout(() => {
    gameState.showMessage = false;
    drawGame();
  }, 1200);
}

// 获取技能颜色
function getSkillColor(skillId) {
  const colors = {
    1: COLORS.skill1,
    2: COLORS.skill2,
    3: COLORS.skill3,
    4: COLORS.skill4,
    5: COLORS.skill5
  };
  return colors[skillId] || COLORS.gold;
}

// 检测点击的技能按钮
function getClickedSkill(x, y) {
  for (let btn of skillButtons) {
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      return btn.id;
    }
  }
  return null;
}

// 棋盘点击处理
function handleBoardClick(x, y) {
  if (gameState.gameOver) {
    return;
  }

  // 检查是否点击了技能按钮
  const skillId = getClickedSkill(x, y);
  if (skillId) {
    handleSkillClick(skillId);
    return;
  }

  // 检查是否点击了棋盘
  if (!boardRect) return;

  const { x: boardX, y: boardY, size } = boardRect;

  if (x < boardX || x > boardX + size ||
      y < boardY || y > boardY + size) {
    return;
  }

  if (gameState.turn !== BLACK) {
    return;
  }

  const col = Math.round((x - boardX - PADDING) / CELL_SIZE);
  const row = Math.round((y - boardY - PADDING) / CELL_SIZE);

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return;
  }

  // 如果有激活的技能
  if (gameState.currentSkill) {
    useSkill(row, col);
    return;
  }

  // 正常下棋
  const result = game.placeStone(row, col);
  console.log('[DEBUG] 玩家下棋结果:', result, '额外回合:', game.extraTurns);

  if (!result.success) {
    showGameMessage(result.message || '无效落子', COLORS.skill1);
    return;
  }

  audioManager.playSound('place');
  updateGameState();
  drawGame();

  // 检查游戏结束
  if (result.gameOver) {
    endGame(result.winner, result.forbidden === true);
    return;
  }

  // 检查是否有额外回合
  if (result.extraTurn) {
    console.log('[DEBUG] 玩家有额外回合,剩余:', game.extraTurns);
    showGameMessage('额外回合! 继续落子', COLORS.skill4);
    // 有额外回合,保持玩家回合,不调用AI
    return;
  }

  // 正常切换到AI回合
  console.log('[DEBUG] 切换到AI回合');
  setTimeout(() => {
    aiMove();
  }, 800);
}

// 处理技能点击
function handleSkillClick(skillId) {
  if (gameState.turn !== BLACK || gameState.gameOver) {
    console.log('[DEBUG] handleSkillClick 被阻止: turn=', gameState.turn, 'gameOver=', gameState.gameOver);
    return;
  }

  const skill = SKILLS[skillId] || SKILL_INFO[skillId];
  if (gameState.playerMp < skill.cost) {
    showGameMessage('内力不足！', COLORS.skill1);
    return;
  }

  // 取消已选技能
  if (gameState.currentSkill === skillId) {
    gameState.currentSkill = null;
    gameState.skillDesc = '静待时机...';
    game.cancelSkill();
    drawGame();
    return;
  }

  // 激活技能
  const result = game.activateSkill(skillId);
  console.log('[DEBUG] 激活技能', skillId, '结果:', result);

  if (result.success) {
    audioManager.playSound('skill');
    if (result.needTarget) {
      gameState.currentSkill = skillId;

      // 根据技能类型设置提示
      if (skillId === 1) {
        gameState.skillDesc = '悔棋:撤销上一步'; // 技能1直接生效,不需要提示
      } else if (skillId === 2) {
        gameState.skillDesc = '选择十字中心点';
      } else if (skillId === 3) {
        gameState.skillDesc = '选择要移动的敌子';
      } else if (skillId === 4) {
        gameState.skillDesc = '跳过对方回合'; // 技能4直接生效
      } else {
        gameState.skillDesc = '请选择目标';
      }

      drawGame();
    } else {
      // 技能4和技能5直接生效
      updateGameState();

      if (skillId === 1) {
        showGameMessage('时光倒流! 悔棋成功!', getSkillColor(skillId));
      } else if (skillId === 4) {
        showGameMessage('静如止水! 跳过对方回合!', getSkillColor(skillId));
      } else if (skillId === 5) {
        showGameMessage('东山再起! 棋盘重置!', getSkillColor(skillId));
      }

      drawGame();
      console.log('[DEBUG] 技能直接生效,skillId:', skillId);
    }
  }
}

// AI 下棋
function aiMove() {
  if (gameState.gameOver) {
    console.log('[DEBUG] AI下棋被阻止: 游戏已结束');
    return;
  }

  if (gameState.turn !== WHITE) {
    console.log('[DEBUG] AI下棋被阻止: 不是AI回合, turn=', gameState.turn);
    return;
  }

  if (aiThinking) {
    console.log('[WARN] AI正在思考中,忽略重复调用');
    return;
  }

  // 检查是否被静如止水跳过
  if (game.skipNextTurn) {
    console.log('[DEBUG] 静如止水生效,跳过AI回合');
    game.skipNextTurn = false;
    game.turn = BLACK;
    // 不增加内力(内力只在下棋时增加)
    updateGameState();
    drawGame();
    showGameMessage('静如止水! 对方已被跳过', COLORS.skill4);
    return;
  }

  aiThinking = true;
  console.log('[DEBUG] AI开始下棋...');

  const result = game.aiMove();
  console.log('[DEBUG] AI下棋结果:', result);

  aiThinking = false;

  if (result.success) {
    updateGameState();
    drawGame();

    if (result.effect) {
      showGameMessage(result.effect.skillName + '!', getSkillColor(result.effect.skillId));
    }

    if (result.gameOver) {
      setTimeout(() => {
        endGame(result.winner, result.forbidden === true);
      }, 500);
    }
  } else {
    console.error('[ERROR] AI无法下棋,强制切换回合');
    game.turn = BLACK;
    updateGameState();
    drawGame();
    showGameMessage('AI陷入困境,轮到你了', COLORS.gold);
  }
}

// 使用技能
function useSkill(row, col) {
  const result = game.useSkill(gameState.currentSkill, row, col);
  console.log('[DEBUG] 使用技能', gameState.currentSkill, '结果:', result);

  if (!result.success) {
    showGameMessage(result.message || '技能使用失败', COLORS.skill1);
    return;
  }

  // 技能3的第一步:选中了敌子,等待第二步
  if (result.needSecondTarget) {
    updateGameState();
    drawGame();
    showGameMessage('已选中敌子,点击目标位置', getSkillColor(gameState.currentSkill));
    // 保持技能激活状态,等待下一次点击
    return;
  }

  updateGameState();
  drawGame();

  // 显示技能效果
  if (result.effect) {
    let message = result.effect.skillName + '!';

    if (result.effect.skillId === 1) {
      message = '时光倒流! 悔棋成功';
    } else if (result.effect.skillId === 2 && result.effect.positions) {
      message += ` 炸毁了${result.effect.positions.length}个棋子`;
    } else if (result.effect.skillId === 3) {
      if (result.effect.type === 'select') {
        message = '已选中敌子,点击目标位置';
      } else if (result.effect.type === 'move') {
        message = '飞沙走石! 移动成功';
      }
    } else if (result.effect.skillId === 4) {
      message = '静如止水! 对方被跳过';
    }

    showGameMessage(message, getSkillColor(result.effect.skillId));
  }

  // 清除技能状态
  gameState.currentSkill = null;
  gameState.skillDesc = '静待时机...';

  drawGame();

  // 正常情况下,技能使用后切换到AI回合
  console.log('[DEBUG] 技能使用后切换到AI');
  setTimeout(() => {
    aiMove();
  }, 800);
}

// 切换音乐
function toggleMusic() {
  musicPlaying = audioManager.toggleMusic();
  audioManager.playSound('click');
  return musicPlaying;
}

// 切换音效
function toggleSound() {
  soundEnabled = audioManager.toggleSound();
  return soundEnabled;
}

// 更新游戏状态
function updateGameState() {
  gameState.turn = game.turn;
  gameState.playerMp = game.mp[BLACK];
  gameState.aiMp = game.mp[WHITE];
}

// 游戏结束
function endGame(winner, isForbidden = false) {
  gameState.gameOver = true;

  // 禁手判负提示
  if (isForbidden) {
    audioManager.playSound('lose');
    showGameMessage('禁手！黑方判负！', COLORS.skill1);
  } else if (winner === BLACK) {
    audioManager.playSound('win');
    showGameMessage('大侠神功盖世！', COLORS.skill2);
  } else {
    audioManager.playSound('lose');
    showGameMessage('魔头技高一筹！', COLORS.skill1);
  }

  setTimeout(() => {
    let content = '';
    if (isForbidden) {
      content = '禁手！黑方判负！\n\n三三、四四、长连均为禁手';
    } else {
      content = winner === BLACK ? '恭喜！你赢了！' : 'AI 赢了！';
    }

    wx.showModal({
      title: '游戏结束',
      content: content,
      confirmText: '重新开始',
      showCancel: false,
      success: () => {
        initGame();
      }
    });
  }, 1500);
}

// 监听触摸
wx.onTouchStart(e => {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 记录触摸开始位置（用于说明书滚动）
    touchStartY = y;
    touchStartGuideScroll = gameState.guideScroll;

    // 如果显示说明书，处理说明书的点击事件
    if (gameState.showGuide) {
      handleGuideClick(x, y);
      return;
    }

    // 检查是否点击了顶部按钮 (现在按钮在AI面板右上角)
    const aiPanelY = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20;
    const aiPanelHeight = AI_INFO_HEIGHT;

    if (y >= aiPanelY && y < aiPanelY + aiPanelHeight) {
      // 按钮在AI面板右上角
      const btnSize = 28;
      const btnSpacing = 6;
      const btnAreaWidth = 70;
      const btnAreaX = SCREEN_WIDTH - BOARD_MARGIN - btnAreaWidth + 6;
      const btnY = aiPanelY + 12;

      const musicBtnX = btnAreaX;
      if (x > musicBtnX && x < musicBtnX + btnSize &&
          y > btnY && y < btnY + btnSize) {
        toggleMusic();
        drawGame();
        return;
      }

      const guideBtnX = musicBtnX + btnSize + btnSpacing;
      if (x > guideBtnX && x < guideBtnX + btnSize &&
          y > btnY && y < btnY + btnSize) {
        gameState.showGuide = true;
        gameState.guideScroll = 0;
        drawGame();
        return;
      }
    }

    handleBoardClick(x, y);
  }
});

// 监听触摸移动 - 用于说明书滚动
wx.onTouchMove(e => {
  if (e.touches.length === 1 && gameState.showGuide) {
    const touch = e.touches[0];
    const y = touch.clientY;

    // 计算滑动距离 (向上滑动为正)
    const deltaY = touchStartY - y;

    // 估算总内容高度
    const contentHeight = GAME_GUIDE.sections.length * 250;
    const contentBottom = SCREEN_HEIGHT - 60;
    const maxScroll = Math.max(0, contentHeight - (contentBottom - (SAFE_AREA_TOP + 60)));

    // 更新滚动位置
    gameState.guideScroll = Math.max(0, Math.min(maxScroll, touchStartGuideScroll + deltaY));

    drawGame();
  }
});

// 处理说明书点击
function handleGuideClick(x, y) {
  // 下方关闭按钮 - 大按钮
  const btnHeight = 50;
  const btnY = SCREEN_HEIGHT - btnHeight - 10;
  const btnPadding = 20;

  if (x >= btnPadding && x <= SCREEN_WIDTH - btnPadding &&
      y >= btnY && y <= btnY + btnHeight) {
    gameState.showGuide = false;
    drawGame();
    audioManager.playSound('click');
    return;
  }
}

// 绘制说明书
function drawGuide() {
  // 半透明背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // 标题栏 - 调整到安全区域
  const titleY = SAFE_AREA_TOP + 20;
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px SimHei, Arial';
  ctx.textAlign = 'left';
  ctx.fillText(GAME_GUIDE.title, 20, titleY);

  // 内容区域 - 留出标题和下方关闭按钮的空间
  const contentTop = SAFE_AREA_TOP + 60;
  const closeBtnHeight = 60;
  const contentBottom = SCREEN_HEIGHT - closeBtnHeight - 10;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, contentTop, SCREEN_WIDTH, contentBottom - contentTop);
  ctx.clip();

  let y = contentTop + 10 - gameState.guideScroll;
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';

  GAME_GUIDE.sections.forEach(section => {
    // 章节标题
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px SimHei, Arial';
    ctx.fillText(section.name, 20, y);
    y += 25;

    // 章节内容
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px Arial';
    section.content.forEach(line => {
      ctx.fillText(line, 25, y);
      y += 18;
    });

    y += 10;
  });

  ctx.restore();

  // 下方关闭按钮 - 大按钮
  const btnHeight = 50;
  const btnY = SCREEN_HEIGHT - btnHeight - 10;
  const btnPadding = 20;

  // 按钮背景
  ctx.fillStyle = COLORS.gold;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(btnPadding, btnY, SCREEN_WIDTH - btnPadding * 2, btnHeight);
  ctx.globalAlpha = 1;

  // 按钮边框
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(btnPadding, btnY, SCREEN_WIDTH - btnPadding * 2, btnHeight);

  // 按钮文字
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 18px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('关 闭', SCREEN_WIDTH / 2, btnY + btnHeight / 2);
}

// 初始化游戏
initGame();

// 首次用户交互时尝试播放音乐 (WeChat小游戏需要用户交互)
function enableMusicOnFirstInteraction() {
  if (!audioManager.musicStarted && audioManager.musicEnabled) {
    try {
      audioManager.bgMusicContext.play().catch(err => {
        console.log('[WARN] 音乐播放失败:', err);
      });
      audioManager.musicStarted = true;
      console.log('[INFO] 首次交互 - 音乐已启动');
    } catch (e) {
      console.log('[ERROR] 启动音乐异常:', e);
    }
  }
}

// 监听棋盘点击事件以启动音乐
canvas.addEventListener('touchstart', () => {
  enableMusicOnFirstInteraction();
});

canvas.addEventListener('click', () => {
  enableMusicOnFirstInteraction();
});
