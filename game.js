const { SkillGomoku, BOARD_SIZE, BLACK, WHITE, SKILLS } = require('./utils/gomoku-skill');
const { GAME_GUIDE } = require('./utils/guide');

// 游戏常量
const CELL_SIZE = 22;
const PADDING = 15;
const BOARD_SIZE_PX = BOARD_SIZE * CELL_SIZE + 2 * PADDING;
const GRID_SPAN = (BOARD_SIZE - 1) * CELL_SIZE;
const GRID_OFFSET = (BOARD_SIZE_PX - GRID_SPAN) / 2;

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
  showWelcome: true,
  showSidePicker: false,
  showSettlement: false,
  settlementData: null,
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

// 欢迎页 Logo 资源
let welcomeLogo = null;
let welcomeLogoLoaded = false;
let welcomeLogoLoading = false;

// 技能动画状态
let skillAnimation = null;
let skillAnimationTimer = null;

// 垃圾话tips（支持多条并行显示）
let tauntTips = [];
let tauntTipTimer = null;
let winningHighlight = null;
let winningHighlightTimer = null;
let systemMessageTimer = null;

const PLAYER_TAUNT_LINES = [
    '这一手我落得很轻，可你接得住吗，嗯？',
    '你先别慌呀，这盘我才刚刚热身而已呢。',
    '看似平平无奇，其实后手全是杀招呀。',
    '你这步路走窄了，兄台，回头都难咯。',
    '江湖讲规矩，但棋盘上我可不讲情面哦。',
    '这口气先压住，我下一手就让你破防哈。',
    '你再算三步吧，不然等会儿又要后悔了。',
    '别眨眼呀，我这子一落就要起风了呢。',
    '这不是碰巧，是我提前给你布的局呀。',
    '别只顾进攻呀，你家后院已经起火咯。',
    '你要是还敢压中路，我就直接封死哈。',
    '唉，你这手太冒进了，像给我递刀呢。',
    '听我一句劝吧，这里真不是你该下的点。',
    '你先稳住心态呀，别又被我一手带走了。',
    '这回合我不急，你急，优势可就在我咯。',
    '你看着像在布局，其实在帮我铺路呀。',
    '再拖一手试试吧，我就顺势反打你了哈。',
    '这一角我收下了，谢啦，真是客气呢。',
    '你要是继续犹豫，节奏可就全归我了哦。',
    '棋到这里，你该想的是怎么体面收场呀。'
];

const OPPONENT_ORDER = ['student', 'coach', 'principal', 'champion', 'demon'];
const OPPONENT_PROFILES = {
  student: {
    id: 'student',
    name: '学生',
    avatar: '🎓',
    intro: '作业不会写，棋子下得飞快。',
    taunts: [
      '这步是我昨晚练了十遍的，嘿嘿。',
      '我作业可以晚交，但这手必须先下！',
      '老师说先手要稳，我可记住了。',
      '你别小看我，我可是社团第一替补。',
      '这盘我要证明新生也能赢老江湖。',
      '你刚那步我在笔记里见过破法。',
      '我可能算不深，但我敢下快棋。',
      '我先记一分，回头请你喝奶茶。',
      '这局要是赢了，我要写进周记里。',
      '别放水啊，我就等你最强一手。'
    ]
  },
  coach: {
    id: 'coach',
    name: '教练',
    avatar: '🧢',
    intro: '嘴上说放轻松，手上全是狠招。',
    taunts: [
      '注意节奏，这手是标准训练题。',
      '你中路站位松了，我要点名批评。',
      '先手控盘，后手反击，基本功别丢。',
      '你这步冒进，像没做热身就上场。',
      '看清局面再冲，不然又要加练。',
      '这不是运气，是复盘后的执行力。',
      '角部让我拿下，盘面就归我了。',
      '你现在得防守，不然训练翻倍。',
      '我给你十秒，想清楚再落子。',
      '下一手还乱来，就跑圈二十圈。'
    ]
  },
  principal: {
    id: 'principal',
    name: '校长',
    avatar: '🏫',
    intro: '主打一个德智体美劳都要赢。',
    taunts: [
      '本局按校规进行，先手请谨慎。',
      '你这手不够规范，记一次提醒。',
      '全盘秩序由我维护，别越界。',
      '课堂纪律不错，可棋路还差一点。',
      '这一步记入档案，后果自负。',
      '你若再冲动，我就直接封锁通路。',
      '棋局如校务，讲的是统筹。',
      '你的漏洞太明显，我必须指出。',
      '请继续努力，优秀还差半步。',
      '终局考核将至，你准备好了吗？'
    ]
  },
  champion: {
    id: 'champion',
    name: '冠军',
    avatar: '🏆',
    intro: '奖杯放一边，先把你放倒。',
    taunts: [
      '开局就给压力，这是冠军节奏。',
      '你这手被我读穿了，继续。',
      '我擅长的就是这种中盘绞杀。',
      '别犹豫，犹豫就会败北。',
      '这条线我拿下，你就很难翻了。',
      '你防守不错，但还不够顶级。',
      '我的每一步都在逼近终点。',
      '要赢我，至少得比这手更狠。',
      '你现在还在试探，我已经定型。',
      '冠军不会失误第二次。'
    ]
  },
  demon: {
    id: 'demon',
    name: '魔王',
    avatar: '👹',
    intro: '笑得越和蔼，下手越离谱。',
    taunts: [
      '哼，就这点算计，也敢在本座面前卖弄吗？',
      '你这步像是示弱呀，倒省得我亲自逼宫了。',
      '别装镇定了，你的破绽我看得一清二楚呢。',
      '再拖又如何，结局还是你一步步走向败局。',
      '你这落点太甜了，本座收下这份大礼哈。',
      '人还在硬撑呀？可你的节奏已经被我拆完了。',
      '你若继续顶中路，本座就顺手把你掀翻咯。',
      '这手不是应对，是你亲手给自己挖坑呢。',
      '你越急我越稳，这盘从头到尾都在我掌中。',
      '认命吧，小侠客，今天这盘你走不出去了。'
    ]
  }
};

// 对局统计（单局 + 会话累计）
let currentMatchStats = {
  startTime: Date.now(),
  playerMoves: 0,
  aiMoves: 0,
  playerSkills: 0,
  aiSkills: 0
};

let sessionStats = {
  totalRounds: 0,
  playerWins: 0,
  aiWins: 0,
  forbiddenLosses: 0,
  totalMoves: 0,
  totalDurationSec: 0
};

let playerSide = BLACK;
let aiSide = WHITE;
let currentOpponentId = 'student';

function setPlayerSide(side) {
  playerSide = side === WHITE ? WHITE : BLACK;
  aiSide = playerSide === BLACK ? WHITE : BLACK;
}

function getSideText(side) {
  return side === BLACK ? '黑子' : '白子';
}

function getCurrentOpponent() {
  return OPPONENT_PROFILES[currentOpponentId] || OPPONENT_PROFILES.demon;
}

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
const AI_INFO_HEIGHT = 62;
const BOARD_MARGIN = 12;
const SKILL_BAR_HEIGHT = 138;
const PLAYER_INFO_HEIGHT = 80;
const AI_PANEL_PADDING = 8;
const TOP_LEFT_BTN_W = 42;
const TOP_LEFT_BTN_H = 40;
const TOP_LEFT_BTN_GAP = 8;

// 颜色定义
const COLORS = {
  bg: '#0b1115',
  boardBg: '#132028',
  boardFrame: '#cda56f',
  boardGrid: '#7b664a',
  skill1: '#9d6a60',
  skill2: '#6f8b74',
  skill3: '#9a865f',
  skill4: '#607b8f',
  skill5: '#7a6f8d',
  gold: '#d7ae78',
  white: '#ffffff',
  text: '#e7e1d6',
  panel: 'rgba(19, 31, 39, 0.88)',
  panelSoft: 'rgba(24, 39, 49, 0.75)',
  ink: '#111a21',
  woodLight: '#f0c483',
  woodDark: '#d8a566'
};

// 绘制圆角路径
function roundedRectPath(x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 圆角卡片
function drawRoundedCard(x, y, w, h, options = {}) {
  const {
    radius = 14,
    fillStyle = COLORS.panel,
    strokeStyle = 'rgba(215, 174, 120, 0.8)',
    lineWidth = 1.5,
    shadowColor = 'rgba(0, 0, 0, 0.25)',
    shadowBlur = 10,
    shadowOffsetY = 3
  } = options;

  ctx.save();
  roundedRectPath(x, y, w, h, radius);
  ctx.fillStyle = fillStyle;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowOffsetY;
  ctx.fill();

  if (strokeStyle && lineWidth > 0) {
    roundedRectPath(x, y, w, h, radius);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 0;
    ctx.stroke();
  }
  ctx.restore();
}

// 圆角进度条
function drawRoundedBar(x, y, w, h, percent, fillColor, trackColor) {
  const p = Math.max(0, Math.min(1, percent));

  ctx.save();
  roundedRectPath(x, y, w, h, h / 2);
  ctx.fillStyle = trackColor;
  ctx.fill();

  if (p > 0) {
    const fillW = Math.max(2, w * p);
    roundedRectPath(x, y, fillW, h, Math.min(h / 2, fillW / 2));
    const grad = ctx.createLinearGradient(x, y, x + fillW, y);
    grad.addColorStop(0, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, fillColor);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  roundedRectPath(x, y, w, h, h / 2);
  ctx.strokeStyle = 'rgba(215, 174, 120, 0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// 按容器比例铺满绘制图片（居中裁切）
function drawImageCover(image, x, y, w, h) {
  if (!image || !image.width || !image.height) return;

  const imageRatio = image.width / image.height;
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;

  if (imageRatio > boxRatio) {
    drawH = h;
    drawW = h * imageRatio;
    drawX = x - (drawW - w) / 2;
  } else {
    drawW = w;
    drawH = w / imageRatio;
    drawY = y - (drawH - h) / 2;
  }

  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

function clearSkillAnimation() {
  skillAnimation = null;
  if (skillAnimationTimer) {
    clearInterval(skillAnimationTimer);
    skillAnimationTimer = null;
  }
}

function getBoardPixel(row, col) {
  if (!boardRect) return null;
  return {
    x: boardRect.x + GRID_OFFSET + col * CELL_SIZE,
    y: boardRect.y + GRID_OFFSET + row * CELL_SIZE
  };
}

function getSkillAnimationProgress() {
  if (!skillAnimation) return 0;
  return Math.max(0, Math.min(1, (Date.now() - skillAnimation.startAt) / skillAnimation.duration));
}

function getAvatarTarget(player, role = null) {
  const isAi = role ? role === 'ai' : player === aiSide;
  // AI头像中心
  if (isAi) {
    const aiLayout = getAIPanelLayout();
    return { x: BOARD_MARGIN + 22, y: aiLayout.panelY + aiLayout.panelHeight / 2 };
  }

  // 玩家头像落点（玩家信息栏左侧）
  const boardTop = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN;
  const playerInfoTop = boardTop + BOARD_SIZE_PX + BOARD_MARGIN;
  const panelY = playerInfoTop + 45;
  const panelH = PLAYER_INFO_HEIGHT - 45;
  return { x: BOARD_MARGIN + 22, y: panelY + panelH / 2 };
}

function getAIPanelLayout() {
  const containerY = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20;
  const panelHeight = Math.max(34, PLAYER_INFO_HEIGHT - 45);
  const panelY = containerY + Math.round((AI_INFO_HEIGHT - panelHeight) / 2);
  return {
    containerY,
    panelY,
    panelHeight
  };
}

function drawPieceAt(x, y, type, options = {}) {
  const { scale = 1, alpha = 1 } = options;
  const radius = 10 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);

  let pieceGradient;
  if (type === BLACK) {
    pieceGradient = ctx.createRadialGradient(x - 3 * scale, y - 3 * scale, 2 * scale, x, y, radius);
    pieceGradient.addColorStop(0, '#5a6369');
    pieceGradient.addColorStop(0.5, '#1e262d');
    pieceGradient.addColorStop(1, '#0c1014');
  } else {
    pieceGradient = ctx.createRadialGradient(x - 3 * scale, y - 3 * scale, 2 * scale, x, y, radius);
    pieceGradient.addColorStop(0, '#ffffff');
    pieceGradient.addColorStop(0.6, '#f0ece3');
    pieceGradient.addColorStop(1, '#ddd5c8');
  }
  ctx.fillStyle = pieceGradient;
  ctx.fill();

  ctx.strokeStyle = type === BLACK ? '#7e8b95' : '#b9b0a5';
  ctx.lineWidth = Math.max(0.8, scale);
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

function shouldHideBoardPiece(row, col) {
  if (!skillAnimation) return false;
  const { effect } = skillAnimation;
  const progress = getSkillAnimationProgress();

  // 飞沙走石：棋子飞行过程中隐藏目标落点的落子，避免重影
  if (effect.skillId === 3 && effect.type === 'move' && effect.to && progress < 0.94) {
    return row === effect.to.row && col === effect.to.col;
  }

  return false;
}

function getLastMoveOf(player) {
  if (!game || !Array.isArray(game.moveHistory)) return null;
  for (let i = game.moveHistory.length - 1; i >= 0; i--) {
    const move = game.moveHistory[i];
    if (move.player === player) return move;
  }
  return null;
}

function clearTauntTip() {
  tauntTips = [];
  if (tauntTipTimer) {
    clearInterval(tauntTipTimer);
    tauntTipTimer = null;
  }
}

function clearWinningHighlight() {
  winningHighlight = null;
  if (winningHighlightTimer) {
    clearInterval(winningHighlightTimer);
    winningHighlightTimer = null;
  }
}

function splitTipText(text, maxChars) {
  if (!text) return [''];
  const lines = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  return lines;
}

function showTip(text, player, options = {}) {
  if (!text) return;

  const variant = options.variant || 'normal';
  const durationByVariant = {
    normal: 6000,
    system: 5200,
    skill: 7000
  };

  tauntTips.push({
    text: String(text),
    player: player === WHITE ? WHITE : BLACK,
    role: options.role || (player === aiSide ? 'ai' : 'player'),
    startAt: Date.now(),
    duration: durationByVariant[variant] || 6000,
    variant,
    accentColor: options.accentColor || null
  });

  if (!tauntTipTimer) {
    tauntTipTimer = setInterval(() => {
      const now = Date.now();
      tauntTips = tauntTips.filter(tip => now - tip.startAt < tip.duration);
      if (tauntTips.length === 0) {
        clearInterval(tauntTipTimer);
        tauntTipTimer = null;
      }
      drawGame();
    }, 33);
  }

  drawGame();
}

function showTauntTip(player) {
  const lines = player === playerSide
    ? PLAYER_TAUNT_LINES
    : getCurrentOpponent().taunts;
  if (lines.length === 0) return;
  const text = lines[Math.floor(Math.random() * lines.length)];
  showTip(text, player, {
    variant: 'normal',
    role: player === aiSide ? 'ai' : 'player'
  });
}

function showSkillTip(skillName, player, skillId, detail) {
  const coreName = String(skillName || '绝学');
  const detailText = detail ? ` ${detail}` : '';
  const shout = `⚡大喝一声：${coreName}！${detailText}`;
  showTip(shout, player, {
    variant: 'skill',
    accentColor: getSkillColor(skillId),
    role: player === aiSide ? 'ai' : 'player'
  });
}

function startWinningHighlight(positions, winner) {
  if (!positions || positions.length === 0) return;

  clearWinningHighlight();
  winningHighlight = {
    positions,
    winner,
    startAt: Date.now(),
    duration: 3000
  };

  winningHighlightTimer = setInterval(() => {
    if (!winningHighlight) return;
    const elapsed = Date.now() - winningHighlight.startAt;
    if (elapsed >= winningHighlight.duration) {
      clearWinningHighlight();
      drawGame();
      return;
    }
    drawGame();
  }, 33);
}

function drawTauntTip() {
  if (!tauntTips || tauntTips.length === 0) return;

  const now = Date.now();
  tauntTips.forEach((tip, index) => {
    const elapsed = now - tip.startAt;
    const progress = Math.max(0, Math.min(1, elapsed / tip.duration));
    if (progress >= 1) return;

    const isSkill = tip.variant === 'skill';
    const fadeStart = isSkill ? 0.93 : 0.9;
    const fadeProgress = progress < fadeStart ? 0 : (progress - fadeStart) / (1 - fadeStart);
    const appear = Math.min(1, progress / (isSkill ? 0.06 : 0.08));
    const alpha = appear * (1 - Math.max(0, Math.min(1, fadeProgress)));

    const tipRole = tip.role || (tip.player === aiSide ? 'ai' : 'player');
    const source = getAvatarTarget(tip.player, tipRole);
    const boardCenterX = boardRect ? (boardRect.x + boardRect.size / 2) : (SCREEN_WIDTH / 2);
    const edgeYTop = boardRect ? (boardRect.y + 28) : (SCREEN_HEIGHT * 0.34);
    const edgeYBottom = boardRect ? (boardRect.y + boardRect.size - 28) : (SCREEN_HEIGHT * 0.66);
    const targetX = boardCenterX + (tipRole === 'ai' ? -16 : 16);
    const targetY = tipRole === 'ai' ? edgeYTop : edgeYBottom;
    const moveT = Math.min(1, progress / (isSkill ? 0.2 : 0.25));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easeOutBack = 1 + c3 * Math.pow(moveT - 1, 3) + c1 * Math.pow(moveT - 1, 2);
    const arcLift = (1 - moveT) * (isSkill ? 30 : 18);
    const swayAmp = (isSkill ? 8 : 5) * Math.max(0, 1 - progress);
    const sway = Math.sin(progress * Math.PI * (isSkill ? 11 : 9) + index * 0.8) * swayAmp;
    const x = source.x + (targetX - source.x) * easeOutBack + sway;
    const y = source.y + (targetY - source.y) * easeOutBack - arcLift + ((index % 3) - 1) * 5;

    const maxChars = isSkill ? 10 : 14;
    const lines = splitTipText(tip.text, maxChars);
    const fontSize = isSkill ? 30 : 20;
    const lineGap = isSkill ? 34 : 23;
    const accentColor = isSkill
      ? (tip.accentColor || COLORS.gold)
      : (tipRole === 'ai' ? 'rgba(255, 147, 118, 0.86)' : 'rgba(255, 255, 255, 0.72)');
    const impactPulse = Math.exp(-Math.pow((progress - 0.13) / 0.07, 2));
    const baseScale = isSkill
      ? (0.78 + Math.min(1, progress / 0.16) * 0.5)
      : (0.78 + Math.min(1, progress / 0.2) * 0.24);
    const popScale = baseScale + impactPulse * (isSkill ? 0.26 : 0.1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.scale(popScale, popScale);

    // 弹道残影（玩家普通垃圾话不画尾迹线）
    const showTrail = isSkill || tipRole === 'ai';
    if (showTrail) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha * (isSkill ? 0.5 : 0.36));
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = isSkill ? 4.2 : 2.8;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo((source.x - x) * 0.42, (source.y - y) * 0.42 + i * 2.5);
        ctx.lineTo((source.x - x) * 0.1, (source.y - y) * 0.1 + i * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    const ringPulse = Math.max(0, 1 - Math.abs((progress - 0.14) / 0.11));
    if (ringPulse > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha * ringPulse * (isSkill ? 0.62 : 0.48);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = isSkill ? 3 : 2;
      const ringR1 = 24 + progress * 86;
      const ringR2 = 16 + progress * 62;
      ctx.beginPath();
      ctx.arc(0, 0, ringR1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, ringR2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (isSkill) {
      const rayPulse = Math.max(0, 1 - progress * 1.8);
      if (rayPulse > 0.01) {
        ctx.save();
        ctx.globalAlpha = alpha * rayPulse * 0.56;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        const rayInner = 18;
        const rayOuter = 36 + progress * 20;
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i + progress * 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * rayInner, Math.sin(a) * rayInner);
          ctx.lineTo(Math.cos(a) * rayOuter, Math.sin(a) * rayOuter);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (progress < 0.16) {
      const flash = 1 - progress / 0.16;
      ctx.save();
      ctx.globalAlpha = alpha * flash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 10 + flash * 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.font = `bold ${fontSize}px SimHei, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.86)';
    ctx.shadowBlur = isSkill ? 14 : 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    const totalHeight = (lines.length - 1) * lineGap;
    lines.forEach((line, idx) => {
      const lineY = idx * lineGap - totalHeight / 2;
      ctx.fillText(line, 0, lineY);
    });
    ctx.restore();
  });
}

function drawWinningHighlight() {
  if (!winningHighlight || !boardRect) return;

  const elapsed = Date.now() - winningHighlight.startAt;
  const progress = Math.max(0, Math.min(1, elapsed / winningHighlight.duration));
  const pulse = 0.7 + 0.5 * Math.sin(progress * Math.PI * 8);
  const color = winningHighlight.winner === BLACK ? 'rgba(132, 241, 186, 1)' : 'rgba(255, 177, 152, 1)';
  const glow = winningHighlight.winner === BLACK ? 'rgba(75, 203, 139, 0.62)' : 'rgba(234, 121, 88, 0.62)';

  const points = winningHighlight.positions
    .map(pos => getBoardPixel(pos.row, pos.col))
    .filter(Boolean);
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineWidth = 11 + pulse * 4;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24 + pulse * 14;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 6 + pulse * 2.6;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 20 + pulse * 12;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  const sparkT = (progress * 1.4) % 1;
  const sparkIdx = sparkT * (points.length - 1);
  const sparkBase = Math.floor(sparkIdx);
  const sparkNext = Math.min(points.length - 1, sparkBase + 1);
  const localT = sparkIdx - sparkBase;
  const sparkX = points[sparkBase].x + (points[sparkNext].x - points[sparkBase].x) * localT;
  const sparkY = points[sparkBase].y + (points[sparkNext].y - points[sparkBase].y) * localT;
  ctx.fillStyle = 'rgba(255, 249, 231, 0.96)';
  ctx.shadowColor = 'rgba(255, 220, 160, 0.9)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 5 + pulse * 1.6, 0, Math.PI * 2);
  ctx.fill();

  points.forEach(p => {
    ctx.fillStyle = 'rgba(255, 244, 214, 0.98)';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6 + pulse * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 230, 192, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10 + pulse * 2.8, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function startSkillAnimation(effect) {
  if (!effect || !effect.skillId) return;

  const durationMap = {
    1: 840,
    2: 760,
    3: 740,
    4: 920,
    5: 980
  };

  clearSkillAnimation();
  skillAnimation = {
    effect,
    startAt: Date.now(),
    duration: durationMap[effect.skillId] || 700
  };

  skillAnimationTimer = setInterval(() => {
    if (!skillAnimation) return;
    const elapsed = Date.now() - skillAnimation.startAt;
    if (elapsed >= skillAnimation.duration) {
      clearSkillAnimation();
      drawGame();
      return;
    }
    drawGame();
  }, 33);
}

function drawSkillAnimation() {
  if (!skillAnimation || !boardRect) return;

  const { effect, startAt, duration } = skillAnimation;
  const progress = Math.max(0, Math.min(1, (Date.now() - startAt) / duration));
  const alpha = 1 - progress;
  const easeOut = 1 - Math.pow(1 - progress, 3);

  ctx.save();
  ctx.globalAlpha = Math.max(0.16, alpha);

  if (effect.skillId === 1 && effect.type === 'undo_pair' && Array.isArray(effect.positions)) {
    // 时光倒流：双方棋子飞回头像
    effect.positions.forEach(pos => {
      const from = getBoardPixel(pos.row, pos.col);
      const to = getAvatarTarget(pos.player);
      if (!from || !to) return;

      const x = from.x + (to.x - from.x) * easeOut;
      const y = from.y + (to.y - from.y) * easeOut;
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.78)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      drawPieceAt(x, y, pos.player, {
        scale: 1 - progress * 0.25,
        alpha: Math.max(0.25, alpha)
      });
    });
  } else if (effect.skillId === 2) {
    // 力拔山兮：十字位爆炸后棋子消失
    const center = effect.center ? getBoardPixel(effect.center.row, effect.center.col) : null;
    if (center) {
      const arm = CELL_SIZE * (0.8 + easeOut * 1.8);
      ctx.strokeStyle = 'rgba(255, 186, 68, 0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(center.x - arm, center.y);
      ctx.lineTo(center.x + arm, center.y);
      ctx.moveTo(center.x, center.y - arm);
      ctx.lineTo(center.x, center.y + arm);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 220, 140, ${0.48 * alpha})`;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 8 + easeOut * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    if (Array.isArray(effect.positions)) {
      effect.positions.forEach(pos => {
        const p = getBoardPixel(pos.row, pos.col);
        if (!p) return;
        const blast = progress < 0.45 ? progress / 0.45 : 1;
        const vanish = progress < 0.45 ? 1 : (1 - (progress - 0.45) / 0.55);
        drawPieceAt(p.x, p.y, pos.player || BLACK, {
          scale: 0.9 + blast * 0.15,
          alpha: Math.max(0, vanish)
        });
        ctx.fillStyle = `rgba(255, 142, 64, ${0.55 * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + blast * 14, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  } else if (effect.skillId === 3) {
    // 飞沙走石：棋子从初始位飞到目标位
    if (effect.type === 'select' && effect.from) {
      const p = getBoardPixel(effect.from.row, effect.from.col);
      if (p) {
        ctx.strokeStyle = 'rgba(238, 226, 152, 0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 + easeOut * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (effect.type === 'move' && effect.from && effect.to) {
      const fromP = getBoardPixel(effect.from.row, effect.from.col);
      const toP = getBoardPixel(effect.to.row, effect.to.col);
      if (fromP && toP) {
        const ctrlX = (fromP.x + toP.x) / 2;
        const ctrlY = Math.min(fromP.y, toP.y) - 18;
        const t = easeOut;
        const flyX = (1 - t) * (1 - t) * fromP.x + 2 * (1 - t) * t * ctrlX + t * t * toP.x;
        const flyY = (1 - t) * (1 - t) * fromP.y + 2 * (1 - t) * t * ctrlY + t * t * toP.y;

        ctx.strokeStyle = 'rgba(244, 220, 140, 0.68)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(fromP.x, fromP.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, flyX, flyY);
        ctx.stroke();

        drawPieceAt(flyX, flyY, effect.player || WHITE, {
          scale: 1.0,
          alpha: Math.max(0.22, alpha)
        });
      }
    }
  } else if (effect.skillId === 4) {
    // 静如止水：时间停止
    const centerX = boardRect.x + BOARD_SIZE_PX / 2;
    const centerY = boardRect.y + BOARD_SIZE_PX / 2;
    ctx.fillStyle = `rgba(122, 176, 234, ${0.2 * alpha})`;
    ctx.fillRect(boardRect.x, boardRect.y, BOARD_SIZE_PX, BOARD_SIZE_PX);

    ctx.strokeStyle = 'rgba(148, 208, 255, 0.92)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, BOARD_SIZE_PX * (0.18 + easeOut * 0.38), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(214, 240, 255, ${0.75 * alpha})`;
    ctx.font = 'bold 20px SimHei, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('时停', centerX, centerY);
  } else if (effect.skillId === 5) {
    // 东山再起：时间倒转，棋子全部飞跑
    const centerX = boardRect.x + BOARD_SIZE_PX / 2;
    const centerY = boardRect.y + BOARD_SIZE_PX / 2;
    ctx.fillStyle = `rgba(255, 225, 154, ${0.24 * alpha})`;
    ctx.fillRect(boardRect.x, boardRect.y, BOARD_SIZE_PX, BOARD_SIZE_PX);

    if (Array.isArray(effect.positions)) {
      effect.positions.forEach((pos, idx) => {
        const p = getBoardPixel(pos.row, pos.col);
        if (!p) return;
        const vx = p.x - centerX;
        const vy = p.y - centerY;
        const jitter = ((idx % 5) - 2) * 2.2;
        const flyX = p.x + vx * easeOut * 1.35 + jitter * progress;
        const flyY = p.y + vy * easeOut * 1.35 - jitter * progress;
        drawPieceAt(flyX, flyY, pos.player, {
          scale: 1 - progress * 0.2,
          alpha: Math.max(0, 1 - progress * 1.1)
        });
      });
    }

    ctx.strokeStyle = `rgba(255, 210, 120, ${0.62 * alpha})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, BOARD_SIZE_PX * (0.18 + easeOut * 0.44), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// 技能信息
const SKILL_INFO = {
  1: { name: '时光倒流', cost: 30, icon: '⏳' },
  2: { name: '力拔山兮', cost: 50, icon: '💪' },
  3: { name: '飞沙走石', cost: 70, icon: '💨' },
  4: { name: '静如止水', cost: 100, icon: '💧' },
  5: { name: '东山再起', cost: 200, icon: '🔥' }
};

const SKILL_BRIEF = {
  1: '黑白双方各回退一步',
  2: '十字中心爆破最多5子',
  3: '把敌方一子搬到空位',
  4: '冻结对方一整个回合',
  5: '时空重置全盘重新开局'
};

function loadWelcomeLogo() {
  if (!canvas || welcomeLogoLoaded || welcomeLogoLoading) return;

  try {
    welcomeLogoLoading = true;
    const logo = wx.createImage ? wx.createImage() : canvas.createImage();
    logo.onload = () => {
      welcomeLogo = logo;
      welcomeLogoLoaded = true;
      welcomeLogoLoading = false;
      if (gameState.showWelcome) {
        drawGame();
      }
      console.log('[DEBUG] 欢迎页Logo加载完成');
    };
    logo.onerror = err => {
      welcomeLogoLoading = false;
      console.log('[WARN] 欢迎页Logo加载失败:', err);
    };

    const candidates = ['images/logo.png', './images/logo.png', '/images/logo.png'];
    const tryResolve = index => {
      if (index >= candidates.length) {
        welcomeLogoLoading = false;
        console.log('[WARN] 欢迎页Logo路径解析失败:', candidates);
        return;
      }

      const src = candidates[index];
      wx.getImageInfo({
        src,
        success: res => {
          logo.src = res.path || src;
        },
        fail: err => {
          console.log('[WARN] Logo路径不可用，尝试下一个:', src, err);
          tryResolve(index + 1);
        }
      });
    };

    if (wx.getImageInfo) {
      tryResolve(0);
    } else {
      logo.src = 'images/logo.png';
    }
  } catch (e) {
    welcomeLogoLoading = false;
    console.log('[WARN] 欢迎页Logo初始化失败:', e);
  }
}

function initAudioForGame() {
  audioManager.initMusic();
  audioManager.initSounds();

  try {
    if (audioManager.bgMusicContext && audioManager.musicEnabled && !audioManager.musicStarted) {
      const playResult = audioManager.bgMusicContext.play();
      if (playResult && typeof playResult.then === 'function') {
        playResult.then(() => {
          audioManager.musicStarted = true;
        }).catch(err => {
          // 微信小游戏可能要求用户交互后才能自动播放
          console.log('[WARN] 背景音乐需交互后播放:', err);
        });
      } else {
        audioManager.musicStarted = true;
      }
    }
  } catch (e) {
    console.log('[ERROR] 启动背景音乐异常:', e);
  }
}

// 初始化游戏
function initGame(showWelcome = true) {
  clearSkillAnimation();
  clearTauntTip();
  clearWinningHighlight();
  clearSystemMessage();

  // 完全重置游戏状态
  game = new SkillGomoku();
  if (showWelcome) {
    currentOpponentId = 'student';
  }
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
    showWelcome: showWelcome,
    showSidePicker: !showWelcome,
    showSettlement: false,
    settlementData: null,
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

  currentMatchStats = {
    startTime: Date.now(),
    playerMoves: 0,
    aiMoves: 0,
    playerSkills: 0,
    aiSkills: 0
  };

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

  loadWelcomeLogo();
  if (!showWelcome) {
    initAudioForGame();
  }

  // 清空画布
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawGame();
  if (!gameState.showWelcome && !gameState.showSidePicker) {
    showSystemMessage('江湖路远 请赐教', '#d4a574', 1600);
    if (!gameState.gameOver && gameState.turn === aiSide) {
      setTimeout(() => {
        aiMove();
      }, 760);
    }
  }
}

// 绘制整个游戏
function drawGame() {
  // 背景层：纵向墨色渐变 + 细纹理
  const bgGradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  bgGradient.addColorStop(0, '#141f26');
  bgGradient.addColorStop(0.4, '#0f171d');
  bgGradient.addColorStop(1, COLORS.bg);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.save();
  ctx.strokeStyle = 'rgba(215, 174, 120, 0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y < SCREEN_HEIGHT; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  // 如果显示说明书，只绘制说明书
  if (gameState.showGuide) {
    drawGuide();
    return;
  }

  if (gameState.showSettlement) {
    drawSettlement();
    return;
  }

  if (gameState.showWelcome) {
    drawWelcome();
    return;
  }

  // 绘制各部分
  drawTopBar();
  drawAIInfo();
  drawBoardArea();
  drawPlayerInfo();
  drawSkillBar();
  if (gameState.showSidePicker) {
    drawSidePicker();
  }
  drawSkillAnimation();
  drawWinningHighlight();
  drawTauntTip();
  if (gameState.showMessage) {
    drawMessage();
  }
}

// 绘制顶部栏
function drawTopBar() {
  const y = SAFE_AREA_TOP; // 使用安全区域顶部
  const titleY = y + 20;
  const topBtns = getInGameTopButtonsLayout();

  // 标题 - 在整个屏幕居中
  const titleGrad = ctx.createLinearGradient(0, y, SCREEN_WIDTH, y);
  titleGrad.addColorStop(0, '#f1d2a4');
  titleGrad.addColorStop(0.5, COLORS.gold);
  titleGrad.addColorStop(1, '#f1d2a4');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 22px KaiTi, STKaiti, SimHei, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;
  ctx.fillText('真技能五子棋', SCREEN_WIDTH / 2, titleY);
  ctx.shadowBlur = 0;

  drawTopToolButton(topBtns.music, musicPlaying);
  drawTopToolButton(topBtns.guide, true);
}

function getInGameTopButtonsLayout() {
  const y = SAFE_AREA_TOP + 2;
  const music = {
    kind: 'music',
    icon: '♪',
    label: '声音',
    x: BOARD_MARGIN,
    y,
    w: TOP_LEFT_BTN_W,
    h: TOP_LEFT_BTN_H
  };
  const guide = {
    kind: 'guide',
    icon: '?',
    label: '说明',
    x: music.x + TOP_LEFT_BTN_W + TOP_LEFT_BTN_GAP,
    y,
    w: TOP_LEFT_BTN_W,
    h: TOP_LEFT_BTN_H
  };
  return { music, guide, y, w: TOP_LEFT_BTN_W, h: TOP_LEFT_BTN_H };
}

function hitTopToolButton(x, y, button) {
  return x >= button.x && x <= button.x + button.w &&
    y >= button.y && y <= button.y + button.h;
}

function getSidePickerLayout() {
  const base = boardRect || {
    x: Math.round((SCREEN_WIDTH - BOARD_SIZE_PX) / 2),
    y: Math.round(SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN),
    size: BOARD_SIZE_PX
  };
  const panelW = Math.min(base.size - 20, SCREEN_WIDTH - 48);
  const panelH = 146;
  const panelX = base.x + (base.size - panelW) / 2;
  const panelY = base.y + (base.size - panelH) / 2;
  const btnGap = 10;
  const btnW = (panelW - 24 - btnGap) / 2;
  const btnH = 52;
  const blackX = panelX + 12;
  const whiteX = blackX + btnW + btnGap;
  const btnY = panelY + panelH - btnH - 14;
  return { panelX, panelY, panelW, panelH, blackX, whiteX, btnY, btnW, btnH };
}

function drawSidePicker() {
  const { panelX, panelY, panelW, panelH, blackX, whiteX, btnY, btnW, btnH } = getSidePickerLayout();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, 'rgba(18, 31, 39, 0.96)');
  panelGrad.addColorStop(1, 'rgba(12, 22, 28, 0.98)');
  drawRoundedCard(panelX, panelY, panelW, panelH, {
    radius: 14,
    fillStyle: panelGrad,
    strokeStyle: 'rgba(215, 174, 120, 0.86)',
    lineWidth: 1.5,
    shadowBlur: 10
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 17px SimHei, Arial';
  ctx.fillText('请选择执子', panelX + panelW / 2, panelY + 34);
  ctx.fillStyle = 'rgba(232, 225, 212, 0.9)';
  ctx.font = '12px SimHei, Arial';
  ctx.fillText('点击后将自动开局', panelX + panelW / 2, panelY + 58);

  drawSideOptionButton(blackX, btnY, btnW, btnH, {
    side: BLACK,
    title: '执黑',
    subtitle: '先手开杀'
  });
  drawSideOptionButton(whiteX, btnY, btnW, btnH, {
    side: WHITE,
    title: '执白',
    subtitle: '后手反打'
  });
}

function drawSideOptionButton(x, y, w, h, options) {
  const isBlack = options.side === BLACK;
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  if (isBlack) {
    bg.addColorStop(0, 'rgba(41, 49, 58, 0.96)');
    bg.addColorStop(1, 'rgba(12, 16, 20, 0.98)');
  } else {
    bg.addColorStop(0, 'rgba(249, 244, 230, 0.95)');
    bg.addColorStop(1, 'rgba(205, 194, 174, 0.92)');
  }

  drawRoundedCard(x, y, w, h, {
    radius: 12,
    fillStyle: bg,
    strokeStyle: isBlack ? 'rgba(210, 225, 238, 0.78)' : 'rgba(126, 105, 72, 0.82)',
    lineWidth: 1.3,
    shadowBlur: 6
  });

  const stoneX = x + 27;
  const stoneY = y + h / 2;
  const stoneR = 13;
  const stoneGrad = ctx.createRadialGradient(stoneX - 5, stoneY - 6, 2, stoneX, stoneY, stoneR);
  if (isBlack) {
    stoneGrad.addColorStop(0, '#6f7881');
    stoneGrad.addColorStop(0.46, '#252b31');
    stoneGrad.addColorStop(1, '#050608');
  } else {
    stoneGrad.addColorStop(0, '#ffffff');
    stoneGrad.addColorStop(0.62, '#ece7dc');
    stoneGrad.addColorStop(1, '#bcb2a0');
  }
  ctx.save();
  ctx.shadowColor = isBlack ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.26)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = stoneGrad;
  ctx.beginPath();
  ctx.arc(stoneX, stoneY, stoneR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isBlack ? '#f2f7ff' : '#1c252b';
  ctx.font = 'bold 15px SimHei, Arial';
  ctx.fillText(options.title, x + 50, y + 20);
  ctx.fillStyle = isBlack ? 'rgba(220, 230, 240, 0.78)' : 'rgba(71, 58, 39, 0.78)';
  ctx.font = '10px SimHei, Arial';
  ctx.fillText(options.subtitle, x + 50, y + 38);
}

function getMainPanelFrame() {
  const panelX = 16;
  const panelW = SCREEN_WIDTH - 32;
  const panelY = SAFE_AREA_TOP + 20;
  const panelH = Math.min(SCREEN_HEIGHT - SAFE_AREA_TOP - 28, 600);
  return { panelX, panelY, panelW, panelH };
}

function getWelcomeLayout() {
  const panelX = 16;
  const panelW = SCREEN_WIDTH - 32;
  const availableTop = SAFE_AREA_TOP + 10;
  const availableH = SCREEN_HEIGHT - availableTop - 28;
  const panelH = Math.min(availableH, 600);
  const panelY = availableTop + Math.max(0, (availableH - panelH) / 2);

  const btnH = 48;
  const btnW = panelW - 28;
  const startBtnX = panelX + 14;
  const btnY = panelY + panelH - btnH - 16;

  const titleY = panelY + 42;
  const subtitleY = panelY + 74;

  const logoX = panelX + 24;
  const logoW = panelW - 48;
  const logoY = subtitleY + 14;
  const opponentTitleY = btnY - 126;
  const maxLogoH = opponentTitleY - logoY - 98;
  const logoH = Math.max(72, Math.min(206, maxLogoH));
  const textStartY = logoY + logoH + 24;
  const textLineGap = 18;
  const opponentGridY = opponentTitleY + 16;
  const opponentIntroY = opponentGridY + 56;

  return {
    panelX,
    panelY,
    panelW,
    panelH,
    titleY,
    subtitleY,
    logoX,
    logoY,
    logoW,
    logoH,
    textStartY,
    textLineGap,
    opponentTitleY,
    opponentGridY,
    opponentIntroY,
    startBtnX,
    btnY,
    btnW,
    btnH
  };
}

function getWelcomeOpponentButtons(layout) {
  const ids = OPPONENT_ORDER;
  const gap = 6;
  const btnH = 38;
  const btnW = Math.floor((layout.panelW - 28 - gap * 4) / 5);
  const startX = layout.panelX + 14;
  const rowY = layout.opponentGridY;

  const buttons = [];
  for (let i = 0; i < ids.length; i++) {
    buttons.push({
      id: ids[i],
      x: startX + i * (btnW + gap),
      y: rowY,
      w: btnW,
      h: btnH
    });
  }
  return buttons;
}

function drawWelcome() {
  const layout = getWelcomeLayout();
  const {
    panelX, panelY, panelW, panelH,
    titleY, subtitleY,
    logoX, logoY, logoW, logoH,
    textStartY, textLineGap, opponentTitleY, opponentIntroY, startBtnX, btnY, btnW, btnH
  } = layout;
  const topBtns = getInGameTopButtonsLayout();

  // 欢迎页去掉大边框，仅保留内容布局

  drawTopToolButton(topBtns.music, musicPlaying);
  drawTopToolButton(topBtns.guide, true);

  const titleGrad = ctx.createLinearGradient(panelX, titleY, panelX + panelW, titleY);
  titleGrad.addColorStop(0, '#f2d5ab');
  titleGrad.addColorStop(0.5, COLORS.gold);
  titleGrad.addColorStop(1, '#f2d5ab');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 28px KaiTi, STKaiti, SimHei, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('真技能五子棋', panelX + panelW / 2, titleY);

  ctx.fillStyle = 'rgba(226, 216, 198, 0.9)';
  ctx.font = '13px SimHei, Arial';
  ctx.fillText('江湖棋局 · 技能博弈', panelX + panelW / 2, subtitleY);

  ctx.save();
  roundedRectPath(logoX, logoY, logoW, logoH, 14);
  ctx.clip();
  if (welcomeLogoLoaded && welcomeLogo) {
    drawImageCover(welcomeLogo, logoX, logoY, logoW, logoH);
  } else {
    const logoBg = ctx.createLinearGradient(logoX, logoY, logoX, logoY + logoH);
    logoBg.addColorStop(0, 'rgba(22, 34, 43, 0.95)');
    logoBg.addColorStop(1, 'rgba(12, 20, 26, 0.96)');
    ctx.fillStyle = logoBg;
    ctx.fillRect(logoX, logoY, logoW, logoH);
    ctx.fillStyle = 'rgba(215, 174, 120, 0.9)';
    ctx.font = 'bold 14px SimHei, Arial';
    ctx.fillText('LOGO 加载中...', logoX + logoW / 2, logoY + logoH / 2);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(226, 216, 198, 0.94)';
  ctx.font = 'bold 15px SimHei, Arial';
  ctx.fillText('技能五子棋就是在传统五子棋中', panelX + panelW / 2, textStartY);
  ctx.fillText('加入技能，好好玩', panelX + panelW / 2, textStartY + textLineGap);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 14px SimHei, Arial';
  ctx.fillText('选择对手', panelX + panelW / 2, opponentTitleY);

  const opponentButtons = getWelcomeOpponentButtons(layout);
  opponentButtons.forEach(btn => {
    const profile = OPPONENT_PROFILES[btn.id];
    const selected = btn.id === currentOpponentId;
    drawRoundedCard(btn.x, btn.y, btn.w, btn.h, {
      radius: 10,
      fillStyle: selected ? 'rgba(215, 174, 120, 0.28)' : 'rgba(26, 40, 50, 0.7)',
      strokeStyle: selected ? 'rgba(242, 218, 176, 0.9)' : 'rgba(130, 153, 172, 0.46)',
      lineWidth: selected ? 1.4 : 1
    });
    ctx.fillStyle = selected ? '#fff3db' : 'rgba(231, 238, 244, 0.9)';
    ctx.font = selected ? 'bold 12px SimHei, Arial' : '11px SimHei, Arial';
    ctx.fillText(`${profile.avatar} ${profile.name}`, btn.x + btn.w / 2, btn.y + btn.h / 2);
  });

  const selectedProfile = getCurrentOpponent();
  ctx.fillStyle = 'rgba(231, 223, 209, 0.92)';
  ctx.font = '11px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(selectedProfile.intro || '', panelX + panelW / 2, opponentIntroY);

  // 开始按钮
  drawRoundedCard(startBtnX, btnY, btnW, btnH, {
    radius: 12,
    fillStyle: 'rgba(111, 139, 116, 0.95)',
    strokeStyle: 'rgba(236, 244, 232, 0.88)',
    lineWidth: 1.4,
    shadowBlur: 6
  });
  ctx.fillStyle = '#f5efe2';
  ctx.font = 'bold 16px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('开始对局', startBtnX + btnW / 2, btnY + btnH / 2);
}

function getSettlementLayout() {
  const { panelX, panelY, panelW, panelH } = getMainPanelFrame();

  const btnH = 44;
  const btnGap = 10;
  const btnW = (panelW - 28 - btnGap) / 2;
  const homeBtnX = panelX + 14;
  const replayBtnX = homeBtnX + btnW + btnGap;
  const btnY = panelY + panelH - btnH - 14;

  return {
    panelX,
    panelY,
    panelW,
    panelH,
    homeBtnX,
    replayBtnX,
    btnY,
    btnW,
    btnH
  };
}

function buildAiReview(winner, isForbidden, durationSec) {
  const opponent = getCurrentOpponent();
  const playerWon = winner === playerSide;
  const totalMoves = game.moveCount;
  const playerSkillLead = currentMatchStats.playerSkills - currentMatchStats.aiSkills;
  const aiMpLead = game.mp[aiSide] - game.mp[playerSide];
  const pace = durationSec <= 60 ? '快棋节奏' : (durationSec <= 180 ? '稳扎稳打' : '长盘拉扯');
  const lines = [];

  if (isForbidden) {
    lines.push(playerWon
      ? `${opponent.name}复盘：对手禁手送局，规则就是最后一刀。`
      : `${opponent.name}复盘：黑棋禁手爆雷，这盘输在太贪。`);
  } else if (playerWon) {
    lines.push(`${opponent.name}复盘：你守住关键连线，收官那手够狠。`);
  } else {
    lines.push(`${opponent.name}复盘：我用连续威胁压缩空间，你慢了半拍。`);
  }

  if (playerSkillLead > 0) {
    lines.push(`技能使用更主动，但别只靠绝学，先手形势也要经营。`);
  } else if (playerSkillLead < 0) {
    lines.push(`这局我技能压制更多，关键回合别舍不得内力。`);
  } else {
    lines.push(`双方技能出手接近，胜负主要落在连线攻防。`);
  }

  if (aiMpLead > 60) {
    lines.push(`你留下太多内力没转化，下一局该更早抢节奏。`);
  } else if (totalMoves >= 45) {
    lines.push(`棋局拖入后半盘，防四和拆三要比抢边更重要。`);
  } else {
    lines.push(`${pace}里最怕漏防，看到活三先别急着反打。`);
  }

  return {
    title: 'AI复盘',
    tag: playerWon ? '可圈可点' : '下局再战',
    lines
  };
}

function buildSettlementData(winner, isForbidden) {
  const durationSec = Math.max(1, Math.round((Date.now() - currentMatchStats.startTime) / 1000));

  sessionStats.totalRounds += 1;
  sessionStats.totalMoves += game.moveCount;
  sessionStats.totalDurationSec += durationSec;
  if (winner === playerSide) {
    sessionStats.playerWins += 1;
  } else {
    sessionStats.aiWins += 1;
  }
  if (isForbidden && winner !== playerSide) {
    sessionStats.forbiddenLosses += 1;
  }

  const winRate = sessionStats.totalRounds > 0
    ? Math.round((sessionStats.playerWins / sessionStats.totalRounds) * 100)
    : 0;

  const resultTitle = isForbidden
    ? '禁手判负'
    : (winner === playerSide ? '本局胜利' : '本局失利');
  const resultColor = isForbidden
    ? (winner === playerSide ? COLORS.skill2 : COLORS.skill1)
    : (winner === playerSide ? COLORS.skill2 : COLORS.skill1);

  return {
    resultTitle,
    resultColor,
    durationSec,
    totalMoves: game.moveCount,
    isPlayerWin: winner === playerSide,
    review: buildAiReview(winner, isForbidden, durationSec),
    player: {
      moves: currentMatchStats.playerMoves,
      skills: currentMatchStats.playerSkills,
      mp: game.mp[playerSide]
    },
    ai: {
      moves: currentMatchStats.aiMoves,
      skills: currentMatchStats.aiSkills,
      mp: game.mp[aiSide]
    },
    session: {
      rounds: sessionStats.totalRounds,
      playerWins: sessionStats.playerWins,
      aiWins: sessionStats.aiWins,
      forbiddenLosses: sessionStats.forbiddenLosses,
      winRate
    }
  };
}

function formatDuration(durationSec) {
  const total = Math.max(0, Math.round(durationSec || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds}秒`;
  return `${minutes}分${seconds}秒`;
}

function drawSettlementMetric(x, y, w, label, value, color) {
  drawRoundedCard(x, y, w, 34, {
    radius: 8,
    fillStyle: 'rgba(17, 27, 34, 0.72)',
    strokeStyle: 'rgba(215, 174, 120, 0.26)',
    lineWidth: 1,
    shadowBlur: 2,
    shadowOffsetY: 1
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color || COLORS.gold;
  ctx.font = 'bold 13px Arial';
  ctx.fillText(String(value), x + w / 2, y + 12);
  ctx.fillStyle = 'rgba(231, 225, 214, 0.75)';
  ctx.font = '10px SimHei, Arial';
  ctx.fillText(label, x + w / 2, y + 26);
}

function drawSettlementTextLines(lines, x, y, maxChars, lineGap) {
  let lineY = y;
  (lines || []).forEach(text => {
    splitTipText(String(text), maxChars).forEach(line => {
      ctx.fillText(line, x, lineY);
      lineY += lineGap;
    });
  });
}

function drawSettlement() {
  const layout = getSettlementLayout();
  const { panelX, panelY, panelW, panelH, homeBtnX, replayBtnX, btnY, btnW, btnH } = layout;
  const data = gameState.settlementData;
  if (!data) return;

  const maskGrad = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  maskGrad.addColorStop(0, 'rgba(6, 12, 16, 0.78)');
  maskGrad.addColorStop(0.5, 'rgba(11, 18, 23, 0.64)');
  maskGrad.addColorStop(1, 'rgba(0, 0, 0, 0.74)');
  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = data.resultColor;
  ctx.font = 'bold 34px KaiTi, STKaiti, SimHei, serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fillText(data.resultTitle, panelX + panelW / 2, panelY + 44);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(231, 225, 214, 0.95)';
  ctx.font = '12px SimHei, Arial';
  ctx.fillText(`用时 ${formatDuration(data.durationSec)} · 总手数 ${data.totalMoves}`, panelX + panelW / 2, panelY + 73);

  const metricY = panelY + 94;
  const metricGap = 7;
  const metricW = (panelW - 28 - metricGap * 2) / 3;
  const metricX = panelX + 14;
  drawSettlementMetric(metricX, metricY, metricW, '玩家技能', data.player.skills, COLORS.skill2);
  drawSettlementMetric(metricX + metricW + metricGap, metricY, metricW, 'AI技能', data.ai.skills, COLORS.skill1);
  drawSettlementMetric(metricX + (metricW + metricGap) * 2, metricY, metricW, '胜率', `${data.session.winRate}%`, COLORS.gold);

  const boxY = metricY + 48;
  const boxH = 82;
  const halfGap = 8;
  const boxW = (panelW - 28 - halfGap) / 2;
  const playerX = panelX + 14;
  const aiX = playerX + boxW + halfGap;
  drawRoundedCard(playerX, boxY, boxW, boxH, {
    radius: 12,
    fillStyle: 'rgba(111, 139, 116, 0.2)',
    strokeStyle: 'rgba(188, 219, 200, 0.5)',
    lineWidth: 1.2
  });
  drawRoundedCard(aiX, boxY, boxW, boxH, {
    radius: 12,
    fillStyle: 'rgba(157, 106, 96, 0.2)',
    strokeStyle: 'rgba(226, 191, 184, 0.5)',
    lineWidth: 1.2
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 12px SimHei, Arial';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`玩家（${getSideText(playerSide)}）`, playerX + 10, boxY + 18);
  ctx.fillText(`${getCurrentOpponent().name}（${getSideText(aiSide)}）`, aiX + 10, boxY + 18);

  ctx.font = '12px Arial';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`落子 ${data.player.moves}`, playerX + 10, boxY + 42);
  ctx.fillText(`内力 ${data.player.mp}/200`, playerX + 10, boxY + 64);

  ctx.fillText(`落子 ${data.ai.moves}`, aiX + 10, boxY + 42);
  ctx.fillText(`内力 ${data.ai.mp}/200`, aiX + 10, boxY + 64);

  const reviewY = boxY + boxH + 12;
  const reviewH = 132;
  drawRoundedCard(panelX + 14, reviewY, panelW - 28, reviewH, {
    radius: 12,
    fillStyle: 'rgba(13, 23, 29, 0.78)',
    strokeStyle: 'rgba(215, 174, 120, 0.48)',
    lineWidth: 1.1,
    shadowBlur: 6
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 14px SimHei, Arial';
  ctx.fillText(`${getCurrentOpponent().avatar} ${data.review.title}`, panelX + 26, reviewY + 24);
  ctx.textAlign = 'right';
  ctx.fillStyle = data.isPlayerWin ? COLORS.skill2 : COLORS.skill1;
  ctx.font = 'bold 11px SimHei, Arial';
  ctx.fillText(data.review.tag, panelX + panelW - 26, reviewY + 24);
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px SimHei, Arial';
  drawSettlementTextLines(data.review.lines, panelX + 26, reviewY + 49, 24, 18);

  const statY = reviewY + reviewH + 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(231, 225, 214, 0.82)';
  ctx.font = '11px SimHei, Arial';
  ctx.fillText(
    `总局 ${data.session.rounds} · 胜/负 ${data.session.playerWins}/${data.session.aiWins} · 禁手负 ${data.session.forbiddenLosses}`,
    panelX + panelW / 2,
    statY + 8
  );

  // 回到主页按钮
  drawRoundedCard(homeBtnX, btnY, btnW, btnH, {
    radius: 12,
    fillStyle: 'rgba(96, 123, 143, 0.78)',
    strokeStyle: 'rgba(200, 214, 228, 0.72)',
    lineWidth: 1.2,
    shadowBlur: 4
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef4f8';
  ctx.font = 'bold 15px SimHei, Arial';
  ctx.fillText('回到主页', homeBtnX + btnW / 2, btnY + btnH / 2);

  // 再来一局按钮
  drawRoundedCard(replayBtnX, btnY, btnW, btnH, {
    radius: 12,
    fillStyle: 'rgba(111, 139, 116, 0.98)',
    strokeStyle: 'rgba(236, 244, 232, 0.86)',
    lineWidth: 1.4,
    shadowBlur: 8
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5efe2';
  ctx.font = 'bold 15px SimHei, Arial';
  ctx.fillText('再来一局', replayBtnX + btnW / 2, btnY + btnH / 2);
}

// 绘制AI信息栏
function drawAIInfo() {
  const { panelY, panelHeight } = getAIPanelLayout();
  const padding = 8;
  const x = BOARD_MARGIN;
  const w = SCREEN_WIDTH - 2 * BOARD_MARGIN;
  const mpPercent = Math.max(0, Math.min(1, gameState.aiMp / 200)); // 上限200

  drawRoundedCard(x, panelY, w, panelHeight, {
    radius: 14,
    fillStyle: 'rgba(18, 30, 38, 0.86)',
    strokeStyle: 'rgba(215, 174, 120, 0.58)',
    lineWidth: 1.4,
    shadowBlur: 6
  });

  // 面板本体作为内力条：按 MP 比例填充
  if (mpPercent > 0) {
    ctx.save();
    roundedRectPath(x, panelY, w, panelHeight, 14);
    ctx.clip();
    const fillW = Math.max(1, Math.floor(w * mpPercent));
    const fillGrad = ctx.createLinearGradient(x, panelY, x + fillW, panelY);
    fillGrad.addColorStop(0, 'rgba(157, 106, 96, 0.42)');
    fillGrad.addColorStop(1, 'rgba(157, 106, 96, 0.72)');
    ctx.fillStyle = fillGrad;
    ctx.fillRect(x, panelY, fillW, panelHeight);
    ctx.restore();
  }

  // 重新描边，避免填充覆盖边线
  ctx.save();
  roundedRectPath(x, panelY, w, panelHeight, 14);
  ctx.strokeStyle = 'rgba(215, 174, 120, 0.58)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // AI 信息（与玩家面板同构）
  const infoX = BOARD_MARGIN + padding;
  const infoY = panelY + padding;
  const avatarCenterX = infoX + 12;
  const avatarCenterY = panelY + panelHeight / 2;
  const nameX = infoX + 32;
  const lineY = avatarCenterY + 0.5;

  ctx.fillStyle = '#f2fff6';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getCurrentOpponent().avatar, avatarCenterX, avatarCenterY + 0.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 13px SimHei, Arial';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${getCurrentOpponent().name}（AI）·${getSideText(aiSide)}`, nameX, lineY);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`内力 ${gameState.aiMp}/200`, x + w - padding, lineY);
  ctx.textBaseline = 'alphabetic';
}

// 绘制棋盘区域
function drawBoardArea() {
  const topMargin = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN; // 调整基于安全区域
  const boardX = Math.round((SCREEN_WIDTH - BOARD_SIZE_PX) / 2);
  const boardY = Math.round(topMargin);

  // 外框卡片
  drawRoundedCard(boardX - 8, boardY - 8, BOARD_SIZE_PX + 16, BOARD_SIZE_PX + 16, {
    radius: 14,
    fillStyle: 'rgba(11, 18, 22, 0.78)',
    strokeStyle: 'rgba(215, 174, 120, 0.9)',
    lineWidth: 2.5,
    shadowBlur: 12
  });

  // 棋盘背景
  const boardGrad = ctx.createLinearGradient(boardX, boardY, boardX, boardY + BOARD_SIZE_PX);
  boardGrad.addColorStop(0, COLORS.woodLight);
  boardGrad.addColorStop(1, COLORS.woodDark);
  drawRoundedCard(boardX, boardY, BOARD_SIZE_PX, BOARD_SIZE_PX, {
    radius: 10,
    fillStyle: boardGrad,
    strokeStyle: 'rgba(143, 101, 58, 0.7)',
    lineWidth: 1.5,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowBlur: 4,
    shadowOffsetY: 2
  });

  // 网格线
  ctx.strokeStyle = COLORS.boardGrid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.95;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const x = boardX + GRID_OFFSET + i * CELL_SIZE;
    const y = boardY + GRID_OFFSET + i * CELL_SIZE;

    // 竖线
    ctx.beginPath();
    ctx.moveTo(x, boardY + GRID_OFFSET);
    ctx.lineTo(x, boardY + GRID_OFFSET + GRID_SPAN);
    ctx.stroke();

    // 横线
    ctx.beginPath();
    ctx.moveTo(boardX + GRID_OFFSET, y);
    ctx.lineTo(boardX + GRID_OFFSET + GRID_SPAN, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 星位
  ctx.fillStyle = '#3b2a1c';
  [3, 7, 11].forEach(pos => {
    [3, 7, 11].forEach(p => {
      ctx.beginPath();
      ctx.arc(boardX + GRID_OFFSET + p * CELL_SIZE, boardY + GRID_OFFSET + pos * CELL_SIZE, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  });

  // 绘制棋子
  const board = game.board;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0 && !shouldHideBoardPiece(r, c)) {
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
  const x = boardX + GRID_OFFSET + col * CELL_SIZE;
  const y = boardY + GRID_OFFSET + row * CELL_SIZE;
  drawPieceAt(x, y, type);
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
  const lastPlayerMove = getLastMoveOf(playerSide);
  const lastAiMove = getLastMoveOf(aiSide);
  const moveLogText = `下棋记录 你(${lastPlayerMove ? `${lastPlayerMove.row + 1},${lastPlayerMove.col + 1}` : '--,--'}) · ${getCurrentOpponent().name}(${lastAiMove ? `${lastAiMove.row + 1},${lastAiMove.col + 1}` : '--,--'})`;
  ctx.fillStyle = COLORS.gold;
  ctx.font = '12px SimHei, Arial';
  ctx.fillText(moveLogText, SCREEN_WIDTH / 2, boardY + 22);

  // 玩家面板
  const panelY = boardY + 45;
  const panelHeight = height - 45;
  const mpPercent = Math.max(0, Math.min(1, gameState.playerMp / 200)); // 上限200

  drawRoundedCard(BOARD_MARGIN, panelY, SCREEN_WIDTH - 2 * BOARD_MARGIN, panelHeight, {
    radius: 14,
    fillStyle: 'rgba(18, 30, 38, 0.86)',
    strokeStyle: 'rgba(215, 174, 120, 0.58)',
    lineWidth: 1.4,
    shadowBlur: 6
  });

  // 面板本体作为内力条：按 MP 比例填充
  if (mpPercent > 0) {
    ctx.save();
    roundedRectPath(BOARD_MARGIN, panelY, SCREEN_WIDTH - 2 * BOARD_MARGIN, panelHeight, 14);
    ctx.clip();
    const panelW = SCREEN_WIDTH - 2 * BOARD_MARGIN;
    const fillW = Math.max(1, Math.floor(panelW * mpPercent));
    const fillGrad = ctx.createLinearGradient(BOARD_MARGIN, panelY, BOARD_MARGIN + fillW, panelY);
    fillGrad.addColorStop(0, 'rgba(111, 139, 116, 0.42)');
    fillGrad.addColorStop(1, 'rgba(111, 139, 116, 0.72)');
    ctx.fillStyle = fillGrad;
    ctx.fillRect(BOARD_MARGIN, panelY, fillW, panelHeight);
    ctx.restore();
  }

  // 重新描边，避免填充覆盖边线
  ctx.save();
  roundedRectPath(BOARD_MARGIN, panelY, SCREEN_WIDTH - 2 * BOARD_MARGIN, panelHeight, 14);
  ctx.strokeStyle = 'rgba(215, 174, 120, 0.58)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // 玩家信息
  const compactPadding = 8;
  const infoX = BOARD_MARGIN + compactPadding;
  const infoY = panelY + compactPadding;
  const avatarCenterX = infoX + 12;
  const avatarCenterY = panelY + panelHeight / 2;
  const nameX = infoX + 32;
  const lineY = avatarCenterY + 0.5;

  // 头像（无边框无背景）
  ctx.fillStyle = '#f2fff6';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧑', avatarCenterX, avatarCenterY + 0.5);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 13px SimHei, Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`玩家（你）·${getSideText(playerSide)}`, nameX, lineY);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`内力 ${gameState.playerMp}/200`, BOARD_MARGIN + (SCREEN_WIDTH - 2 * BOARD_MARGIN) - compactPadding, lineY);
  ctx.textBaseline = 'alphabetic';
}

// 绘制技能栏
function drawSkillBar() {
  const y = SAFE_AREA_TOP + TOP_BAR_HEIGHT - 20 + AI_INFO_HEIGHT + BOARD_MARGIN + BOARD_SIZE_PX + BOARD_MARGIN + PLAYER_INFO_HEIGHT + BOARD_MARGIN; // 调整基于安全区域
  const height = SKILL_BAR_HEIGHT;

  const barGrad = ctx.createLinearGradient(0, y, 0, y + height);
  barGrad.addColorStop(0, 'rgba(11, 19, 24, 0.92)');
  barGrad.addColorStop(1, 'rgba(9, 15, 20, 0.98)');
  drawRoundedCard(BOARD_MARGIN - 4, y + 2, SCREEN_WIDTH - 2 * BOARD_MARGIN + 8, height - 4, {
    radius: 16,
    fillStyle: barGrad,
    strokeStyle: 'rgba(215, 174, 120, 0.52)',
    lineWidth: 1.4,
    shadowBlur: 10
  });

  // 技能按钮
  skillButtons = [];
  const skillCount = 5;
  const gap = 7;
  const buttonWidth = (SCREEN_WIDTH - 2 * BOARD_MARGIN - (skillCount - 1) * gap) / skillCount;
  const buttonHeight = Math.min(112, height - 12);
  const startX = BOARD_MARGIN;
  const buttonY = y + (height - buttonHeight) / 2;

  for (let i = 1; i <= skillCount; i++) {
    const skill = SKILLS[i] || SKILL_INFO[i];
    const x = startX + (i - 1) * (buttonWidth + gap);

    const canUse = gameState.playerMp >= skill.cost && gameState.turn === playerSide && !gameState.gameOver;
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
  const brief = SKILL_BRIEF[id] || '';
  const baseColors = [COLORS.skill1, COLORS.skill2, COLORS.skill3, COLORS.skill4, COLORS.skill5];
  const activeColors = ['#b8877d', '#88a990', '#b4a178', '#809eb4', '#9a8fb2'];
  const fillColor = isActive ? activeColors[id - 1] : (canUse ? baseColors[id - 1] : 'rgba(255,255,255,0.08)');
  const textColor = isActive ? '#2e2a24' : (canUse ? '#f6f1e7' : '#c1c6cb');
  const subTextColor = isActive ? 'rgba(64, 50, 34, 0.95)' : (canUse ? 'rgba(242, 231, 210, 0.95)' : 'rgba(150, 156, 162, 0.9)');
  const iconY = y + Math.round(h * 0.24);
  const nameY = y + Math.round(h * 0.42);
  const costY = y + Math.round(h * 0.56);
  const briefY1 = y + Math.round(h * 0.71);
  const briefY2 = y + Math.round(h * 0.83);

  drawRoundedCard(x, y, w, h, {
    radius: 12,
    fillStyle: fillColor,
    strokeStyle: isActive ? 'rgba(255, 244, 224, 0.95)' : (canUse ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255,255,255,0.12)'),
    lineWidth: isActive ? 2.2 : 1.2,
    shadowColor: 'rgba(0,0,0,0.22)',
    shadowBlur: 6,
    shadowOffsetY: 2
  });

  // 顶部微高光
  ctx.save();
  roundedRectPath(x + 1, y + 1, w - 2, 14, 8);
  ctx.fillStyle = isActive ? 'rgba(255,255,255,0.26)' : (canUse ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
  ctx.fill();
  ctx.restore();

  // 图标
  ctx.fillStyle = textColor;
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.icon, x + w / 2, iconY);

  // 技能名称
  ctx.fillStyle = textColor;
  ctx.font = 'bold 11px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(info.name, x + w / 2, nameY);

  // 消耗
  ctx.fillStyle = subTextColor;
  ctx.font = 'bold 10px Arial';
  ctx.fillText(`MP ${info.cost}`, x + w / 2, costY);

  // 技能简介（提升理解与使用率）
  ctx.fillStyle = textColor;
  ctx.font = '8px SimHei, Arial';
  const briefText = String(brief || '');
  const line1 = briefText.slice(0, 5);
  const line2 = briefText.slice(5, 10);
  ctx.fillText(line1, x + w / 2, briefY1);
  if (line2) {
    ctx.fillText(line2, x + w / 2, briefY2);
  }
}

// 绘制按钮
function drawButton(text, x, y, w, h, color) {
  const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
  bgGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  drawRoundedCard(x, y, w, h, {
    radius: 8,
    fillStyle: bgGrad,
    strokeStyle: color,
    lineWidth: 1.5,
    shadowBlur: 4,
    shadowOffsetY: 1
  });

  ctx.fillStyle = color;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawTopToolButton(button, active = true) {
  const isActiveMusic = button.kind === 'music' && active;
  const stroke = isActiveMusic
    ? 'rgba(73, 205, 122, 0.8)'
    : 'rgba(128, 142, 158, 0.78)';
  const fill = isActiveMusic
    ? 'rgba(18, 76, 52, 0.5)'
    : 'rgba(35, 42, 55, 0.58)';
  const textColor = isActiveMusic
    ? '#57e287'
    : 'rgba(229, 235, 244, 0.88)';

  drawRoundedCard(button.x, button.y, button.w, button.h, {
    radius: 6,
    fillStyle: fill,
    strokeStyle: stroke,
    lineWidth: 1.1,
    shadowBlur: 3,
    shadowOffsetY: 1
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.font = 'bold 16px Arial';
  ctx.fillText(button.icon, button.x + button.w / 2, button.y + 13);
  ctx.font = 'bold 10px SimHei, Arial';
  ctx.fillText(button.label, button.x + button.w / 2, button.y + 30);
}

// 绘制消息
function drawMessage() {
  const isSkillFx = !!skillAnimation;
  const fontSize = isSkillFx ? 18 : 24;
  const boxH = isSkillFx ? 44 : 68;
  const messageY = isSkillFx
    ? (SAFE_AREA_TOP + TOP_BAR_HEIGHT + 14 + boxH / 2)
    : (SCREEN_HEIGHT / 2);

  ctx.font = `bold ${fontSize}px KaiTi, STKaiti, SimHei, serif`;
  const measuredW = ctx.measureText(gameState.message || '').width;
  const boxW = Math.min(
    SCREEN_WIDTH - (isSkillFx ? 84 : 92),
    Math.max(isSkillFx ? 170 : 220, measuredW + (isSkillFx ? 38 : 52))
  );
  const boxX = (SCREEN_WIDTH - boxW) / 2;
  const boxY = messageY - boxH / 2;

  if (!isSkillFx) {
    // 普通提示：保留轻蒙层，但缩弱
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  drawRoundedCard(boxX, boxY, boxW, boxH, {
    radius: isSkillFx ? 12 : 14,
    fillStyle: isSkillFx ? 'rgba(18, 28, 36, 0.82)' : 'rgba(17, 26, 33, 0.9)',
    strokeStyle: isSkillFx ? 'rgba(215, 174, 120, 0.52)' : 'rgba(215, 174, 120, 0.78)',
    lineWidth: isSkillFx ? 1.2 : 1.6,
    shadowBlur: isSkillFx ? 4 : 8,
    shadowOffsetY: 1
  });

  // 文字
  ctx.fillStyle = gameState.messageColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(gameState.message, SCREEN_WIDTH / 2, messageY + 0.5);
}

function clearSystemMessage() {
  if (systemMessageTimer) {
    clearTimeout(systemMessageTimer);
    systemMessageTimer = null;
  }
  gameState.showMessage = false;
}

function showSystemMessage(text, color, duration = 1600) {
  clearSystemMessage();
  gameState.message = text || '';
  gameState.messageColor = color || COLORS.gold;
  gameState.showMessage = true;
  drawGame();

  systemMessageTimer = setTimeout(() => {
    gameState.showMessage = false;
    systemMessageTimer = null;
    drawGame();
  }, Math.max(400, duration));
}

// 显示游戏提示（普通场景走tips）
function showGameMessage(text, color, player) {
  gameState.message = text || '';
  gameState.messageColor = color || COLORS.gold;
  gameState.showMessage = false;

  const tipPlayer = player || gameState.turn || BLACK;
  showTip(gameState.message, tipPlayer);
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

  if (gameState.turn !== playerSide) {
    return;
  }

  const col = Math.round((x - boardX - GRID_OFFSET) / CELL_SIZE);
  const row = Math.round((y - boardY - GRID_OFFSET) / CELL_SIZE);

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

  currentMatchStats.playerMoves += 1;
  audioManager.playSound('place');
  updateGameState();
  drawGame();
  showTauntTip(playerSide);

  // 检查游戏结束
  if (result.gameOver) {
    endGame(result.winner, result.forbidden === true, result.winLine || null);
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
  // 取消已选技能
  if (gameState.currentSkill === skillId) {
    gameState.currentSkill = null;
    gameState.skillDesc = '静待时机...';
    game.cancelSkill();
    drawGame();
    return;
  }

  if (gameState.turn !== playerSide || gameState.gameOver) {
    console.log('[DEBUG] handleSkillClick 被阻止: turn=', gameState.turn, 'gameOver=', gameState.gameOver);
    return;
  }

  const skill = SKILLS[skillId] || SKILL_INFO[skillId];
  if (gameState.playerMp < skill.cost) {
    showGameMessage('内力不足！', COLORS.skill1);
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
      currentMatchStats.playerSkills += 1;
      if (result.effect) {
        startSkillAnimation(result.effect);
      }
      updateGameState();

      if (skillId === 1) {
        showSkillTip(SKILLS[skillId].name, playerSide, skillId, '双子回溯，棋局归位！');
      } else if (skillId === 4) {
        showSkillTip(SKILLS[skillId].name, playerSide, skillId, '封住对手回合！');
      } else if (skillId === 5) {
        showSkillTip(SKILLS[skillId].name, playerSide, skillId, '乾坤逆转，棋盘重置！');
      }

      drawGame();
      console.log('[DEBUG] 技能直接生效,skillId:', skillId);

      // 技能1会切换到AI回合，这里补一次AI触发，避免回合卡住
      if (!gameState.gameOver && gameState.turn === aiSide) {
        setTimeout(() => {
          aiMove();
        }, 800);
      }
    }
  }
}

// AI 下棋
function aiMove() {
  if (gameState.gameOver) {
    console.log('[DEBUG] AI下棋被阻止: 游戏已结束');
    return;
  }

  if (gameState.turn !== aiSide) {
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
    game.turn = playerSide;
    // 不增加内力(内力只在下棋时增加)
    updateGameState();
    drawGame();
    showSkillTip(SKILLS[4].name, playerSide, 4, '对手回合已冻结！');
    return;
  }

  aiThinking = true;
  console.log('[DEBUG] AI开始下棋...');

  const isBlackOpeningMove = aiSide === BLACK && game.turn === BLACK && game.moveCount === 0;
  const result = isBlackOpeningMove
    ? game.placeStone(Math.floor(BOARD_SIZE / 2), Math.floor(BOARD_SIZE / 2))
    : game.aiMove();
  console.log('[DEBUG] AI下棋结果:', result);

  aiThinking = false;

  if (result.success) {
    if (result.effect) {
      currentMatchStats.aiSkills += 1;
      startSkillAnimation(result.effect);
    } else {
      currentMatchStats.aiMoves += 1;
      showTauntTip(aiSide);
    }
    updateGameState();
    drawGame();

    if (result.effect) {
      showSkillTip(result.effect.skillName, aiSide, result.effect.skillId, `${getCurrentOpponent().name}出手，气势压顶！`);
    }

    // 若AI技能后仍是白方回合（例如技能1不消耗回合），继续执行AI动作，避免回合卡住
    if (!result.gameOver && game.turn === aiSide) {
      setTimeout(() => {
        aiMove();
      }, 520);
      return;
    }

    if (result.gameOver) {
      setTimeout(() => {
        endGame(result.winner, result.forbidden === true, result.winLine || null);
      }, 500);
    }
  } else {
    console.error('[ERROR] AI无法下棋,强制切换回合');
    game.turn = playerSide;
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
    if (result.effect) {
      startSkillAnimation(result.effect);
    }
    updateGameState();
    drawGame();
    showTip('锁定敌子，点空位完成移形换位。', playerSide, { variant: 'system' });
    // 保持技能激活状态,等待下一次点击
    return;
  }

  currentMatchStats.playerSkills += 1;
  if (result.effect) {
    startSkillAnimation(result.effect);
  }
  updateGameState();
  drawGame();

  // 显示技能效果
  if (result.effect) {
    let detail = '';
    if (result.effect.skillId === 1) {
      detail = '双子回溯，悔棋成功！';
    } else if (result.effect.skillId === 2 && result.effect.positions) {
      detail = `十字震碎${result.effect.positions.length}枚棋子！`;
    } else if (result.effect.skillId === 3 && result.effect.type === 'move') {
      detail = '移形换位，落点已改写！';
    } else if (result.effect.skillId === 4) {
      detail = '对手回合已被封住！';
    }

    showSkillTip(result.effect.skillName, playerSide, result.effect.skillId, detail);
  }

  // 清除技能状态
  gameState.currentSkill = null;
  gameState.skillDesc = '静待时机...';

  drawGame();

  // 仅在当前为AI回合时触发AI行动（例如某些技能会保持当前回合不变）
  if (!gameState.gameOver && gameState.turn === aiSide) {
    console.log('[DEBUG] 技能使用后由AI行动');
    setTimeout(() => {
      aiMove();
    }, 800);
  }
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
  gameState.playerMp = game.mp[playerSide];
  gameState.aiMp = game.mp[aiSide];
}

// 游戏结束
function endGame(winner, isForbidden = false, winLine = null) {
  if (gameState.showSettlement) return;

  clearSkillAnimation();
  clearTauntTip();
  clearWinningHighlight();
  clearSystemMessage();
  gameState.gameOver = true;

  let settleDelay = 1200;
  if (!isForbidden && Array.isArray(winLine) && winLine.length >= 5) {
    startWinningHighlight(winLine, winner);
    settleDelay = 3200;
  }
  const systemDuration = Math.max(900, Math.min(1800, settleDelay - 120));

  // 结算提示走全局系统提示，不走垃圾话
  if (isForbidden) {
    if (winner === playerSide) {
      audioManager.playSound('win');
      showSystemMessage('对手触发禁手！你胜了！', COLORS.skill2, systemDuration);
    } else {
      audioManager.playSound('lose');
      showSystemMessage('禁手！你方判负！', COLORS.skill1, systemDuration);
    }
  } else if (winner === playerSide) {
    audioManager.playSound('win');
    showSystemMessage('大侠神功盖世！', COLORS.skill2, systemDuration);
  } else {
    audioManager.playSound('lose');
    showSystemMessage(`${getCurrentOpponent().name}技高一筹！`, COLORS.skill1, systemDuration);
  }

  setTimeout(() => {
    gameState.settlementData = buildSettlementData(winner, isForbidden);
    gameState.showSettlement = true;
    gameState.showMessage = false;
    drawGame();
  }, settleDelay);
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

    if (gameState.showSettlement) {
      handleSettlementClick(x, y);
      return;
    }

    if (gameState.showWelcome) {
      handleWelcomeClick(x, y);
      return;
    }

    if (gameState.showSidePicker) {
      handleSidePickerClick(x, y);
      return;
    }

    // 检查左上角按钮（声音 + 说明）
    const topBtns = getInGameTopButtonsLayout();
    if (hitTopToolButton(x, y, topBtns.music)) {
      toggleMusic();
      drawGame();
      return;
    }
    if (hitTopToolButton(x, y, topBtns.guide)) {
      audioManager.playSound('click');
      gameState.showGuide = true;
      gameState.guideScroll = 0;
      drawGame();
      return;
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
    const layout = getGuideLayout();
    const contentHeight = getGuideContentHeight(layout.contentW);
    const maxScroll = Math.max(0, contentHeight - layout.contentH);

    // 更新滚动位置
    gameState.guideScroll = Math.max(0, Math.min(maxScroll, touchStartGuideScroll + deltaY));

    drawGame();
  }
});

function getGuideLayout() {
  const panelX = 12;
  const panelW = SCREEN_WIDTH - 24;
  const maxAvailableH = SCREEN_HEIGHT - SAFE_AREA_TOP - 36;
  const desiredH = SCREEN_HEIGHT * 0.76;
  const panelH = Math.min(maxAvailableH, Math.max(430, desiredH));
  const panelY = SAFE_AREA_TOP + Math.max(8, (maxAvailableH - panelH) / 2);

  const panelPadding = 12;
  const headerH = 54;
  const closeAreaH = 70;

  const contentX = panelX + panelPadding;
  const contentY = panelY + headerH + 6;
  const contentW = panelW - panelPadding * 2;
  const contentH = panelH - headerH - closeAreaH - 8;

  const closeBtnH = 44;
  const closeBtnX = panelX + panelPadding;
  const closeBtnY = panelY + panelH - closeBtnH - 14;
  const closeBtnW = panelW - panelPadding * 2;

  return {
    panelX,
    panelY,
    panelW,
    panelH,
    headerH,
    contentX,
    contentY,
    contentW,
    contentH,
    closeBtnX,
    closeBtnY,
    closeBtnW,
    closeBtnH
  };
}

function getGuideContentHeight(contentW) {
  let total = 0;
  const lineMaxChars = Math.max(16, Math.floor((contentW - 42) / 11.5));

  GAME_GUIDE.sections.forEach(section => {
    let sectionLines = 0;
    section.content.forEach(line => {
      sectionLines += splitGuideText(String(line), lineMaxChars).length;
    });
    // 与 drawGuide 中每个 section 的真实占高保持一致:
    // 标题区34 + 每行18 + 分段间距12
    total += 46 + sectionLines * 18;
  });

  return total + 14;
}

function splitGuideText(text, maxChars) {
  if (!text) return [''];
  const lines = [];
  for (let i = 0; i < text.length; i += maxChars) {
    lines.push(text.slice(i, i + maxChars));
  }
  return lines.length > 0 ? lines : [''];
}

function handleWelcomeClick(x, y) {
  const layout = getWelcomeLayout();
  const { startBtnX, btnY, btnW, btnH } = layout;
  const topBtns = getInGameTopButtonsLayout();

  // 欢迎页左上角按钮（与对局内一致）
  if (hitTopToolButton(x, y, topBtns.music)) {
    toggleMusic();
    drawGame();
    return;
  }
  if (hitTopToolButton(x, y, topBtns.guide)) {
    audioManager.playSound('click');
    gameState.showGuide = true;
    gameState.guideScroll = 0;
    drawGame();
    return;
  }

  // 选择对手
  const opponentButtons = getWelcomeOpponentButtons(layout);
  for (let i = 0; i < opponentButtons.length; i++) {
    const btn = opponentButtons[i];
    if (x >= btn.x && x <= btn.x + btn.w &&
        y >= btn.y && y <= btn.y + btn.h) {
      currentOpponentId = btn.id;
      audioManager.playSound('click');
      drawGame();
      return;
    }
  }

  if (x >= startBtnX && x <= startBtnX + btnW &&
      y >= btnY && y <= btnY + btnH) {
    gameState.showWelcome = false;
    gameState.showGuide = false;
    gameState.showSidePicker = true;
    initAudioForGame();
    clearSystemMessage();
    drawGame();
    return;
  }
}

function handleSidePickerClick(x, y) {
  const { blackX, whiteX, btnY, btnW, btnH } = getSidePickerLayout();
  let selected = null;
  if (x >= blackX && x <= blackX + btnW && y >= btnY && y <= btnY + btnH) {
    selected = BLACK;
  } else if (x >= whiteX && x <= whiteX + btnW && y >= btnY && y <= btnY + btnH) {
    selected = WHITE;
  }
  if (!selected) return;

  setPlayerSide(selected);
  gameState.showSidePicker = false;
  game.turn = BLACK;
  updateGameState();
  drawGame();
  showSystemMessage('江湖路远 请赐教', '#d4a574', 1300);

  if (aiSide === BLACK) {
    setTimeout(() => {
      aiMove();
    }, 520);
  }
}

function handleSettlementClick(x, y) {
  const { homeBtnX, replayBtnX, btnY, btnW, btnH } = getSettlementLayout();

  if (x >= homeBtnX && x <= homeBtnX + btnW &&
      y >= btnY && y <= btnY + btnH) {
    audioManager.playSound('click');
    initGame(true);
    return;
  }

  if (x >= replayBtnX && x <= replayBtnX + btnW &&
      y >= btnY && y <= btnY + btnH) {
    audioManager.playSound('click');
    initGame(false);
    return;
  }
}

// 处理说明书点击
function handleGuideClick(x, y) {
  const layout = getGuideLayout();
  const { closeBtnX, closeBtnY, closeBtnW, closeBtnH } = layout;

  if (x >= closeBtnX && x <= closeBtnX + closeBtnW &&
      y >= closeBtnY && y <= closeBtnY + closeBtnH) {
    gameState.showGuide = false;
    drawGame();
    return;
  }
}

// 绘制说明书
function drawGuide() {
  // 半透明背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const layout = getGuideLayout();
  const {
    panelX, panelY, panelW, panelH,
    headerH, contentX, contentY, contentW, contentH,
    closeBtnX, closeBtnY, closeBtnW, closeBtnH
  } = layout;

  drawRoundedCard(panelX, panelY, panelW, panelH, {
    radius: 16,
    fillStyle: 'rgba(15, 25, 31, 0.97)',
    strokeStyle: 'rgba(215, 174, 120, 0.88)',
    lineWidth: 1.5,
    shadowBlur: 10
  });

  const headerGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + headerH);
  headerGrad.addColorStop(0, 'rgba(215, 174, 120, 0.22)');
  headerGrad.addColorStop(1, 'rgba(215, 174, 120, 0.08)');
  ctx.save();
  roundedRectPath(panelX + 1, panelY + 1, panelW - 2, headerH, 14);
  ctx.fillStyle = headerGrad;
  ctx.fill();
  ctx.restore();

  // 标题
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px KaiTi, STKaiti, SimHei, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(GAME_GUIDE.title, panelX + panelW / 2, panelY + headerH / 2 + 1);

  // 内容容器
  drawRoundedCard(contentX, contentY, contentW, contentH, {
    radius: 12,
    fillStyle: 'rgba(9, 16, 21, 0.75)',
    strokeStyle: 'rgba(215, 174, 120, 0.22)',
    lineWidth: 1,
    shadowBlur: 0,
    shadowOffsetY: 0
  });

  ctx.save();
  ctx.beginPath();
  roundedRectPath(contentX, contentY, contentW, contentH, 12);
  ctx.clip();

  let y = contentY + 14 - gameState.guideScroll;
  ctx.fillStyle = COLORS.text;
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';

  GAME_GUIDE.sections.forEach(section => {
    const lineMaxChars = Math.max(16, Math.floor((contentW - 34) / 11.5));
    const sectionX = contentX + 10;
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px SimHei, Arial';
    ctx.fillText(section.name, sectionX, y + 15);

    ctx.strokeStyle = 'rgba(215, 174, 120, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sectionX + 92, y + 11);
    ctx.lineTo(contentX + contentW - 10, y + 11);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px Arial';
    let lineY = y + 34;
    section.content.forEach(line => {
      splitGuideText(String(line), lineMaxChars).forEach(wrapped => {
        ctx.fillText(wrapped, sectionX + 4, lineY);
        lineY += 18;
      });
    });

    y = lineY + 12;
  });

  ctx.restore();

  // 下方关闭按钮
  const closeGrad = ctx.createLinearGradient(closeBtnX, closeBtnY, closeBtnX, closeBtnY + closeBtnH);
  closeGrad.addColorStop(0, 'rgba(215, 174, 120, 0.22)');
  closeGrad.addColorStop(1, 'rgba(215, 174, 120, 0.35)');
  drawRoundedCard(closeBtnX, closeBtnY, closeBtnW, closeBtnH, {
    radius: 12,
    fillStyle: closeGrad,
    strokeStyle: 'rgba(215, 174, 120, 0.9)',
    lineWidth: 1.8,
    shadowBlur: 6
  });

  // 按钮文字
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 18px SimHei, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('关 闭', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2);
}

// 初始化游戏
initGame();

// 首次用户交互时尝试播放音乐 (WeChat小游戏需要用户交互)
function enableMusicOnFirstInteraction() {
  if (audioManager.musicStarted || !audioManager.musicEnabled) return;

  try {
    if (!audioManager.bgMusicContext) {
      audioManager.initMusic();
    }
    const bgCtx = audioManager.bgMusicContext;
    if (!bgCtx || typeof bgCtx.play !== 'function') {
      return;
    }

    const playResult = bgCtx.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(err => {
        console.log('[WARN] 音乐播放失败:', err);
      });
    }
    audioManager.musicStarted = true;
    console.log('[INFO] 首次交互 - 音乐已启动');
  } catch (e) {
    console.log('[ERROR] 启动音乐异常:', e);
  }
}

// 监听棋盘点击事件以启动音乐
if (canvas && typeof canvas.addEventListener === 'function') {
  canvas.addEventListener('touchstart', () => {
    enableMusicOnFirstInteraction();
  });

  canvas.addEventListener('click', () => {
    enableMusicOnFirstInteraction();
  });
}
