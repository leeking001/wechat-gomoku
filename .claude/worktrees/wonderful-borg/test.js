/**
 * 五子棋游戏逻辑单元测试
 * 运行: node test.js
 */

const { SkillGomoku, BOARD_SIZE, EMPTY, BLACK, WHITE, SKILLS } = require('./utils/gomoku-skill');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(testName);
    console.log(`  ❌ FAIL: ${testName}`);
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(testName);
    console.log(`  ❌ FAIL: ${testName} (expected=${expected}, actual=${actual})`);
  }
}

// ========== 基础功能测试 ==========
console.log('\n=== 1. 基础初始化测试 ===');
{
  const g = new SkillGomoku();
  assertEqual(g.turn, BLACK, '初始回合应为黑方');
  assertEqual(g.mp[BLACK], 0, '黑方初始内力应为0');
  assertEqual(g.mp[WHITE], 0, '白方初始内力应为0');
  assertEqual(g.gameOver, false, '初始游戏未结束');
  assertEqual(g.board.length, 15, '棋盘应为15行');
  assertEqual(g.board[0].length, 15, '棋盘应为15列');
  assertEqual(g.moveCount, 0, '初始步数为0');
}

// ========== 落子测试 ==========
console.log('\n=== 2. 落子测试 ===');
{
  const g = new SkillGomoku();

  // 正常落子
  const r1 = g.placeStone(7, 7);
  assert(r1.success, '中心落子应成功');
  assertEqual(g.board[7][7], BLACK, '落子后棋盘应有黑子');
  assertEqual(g.turn, WHITE, '落子后应切换为白方');
  assertEqual(g.mp[BLACK], 5, '落子后内力应+5');
  assertEqual(g.moveCount, 1, '步数应为1');

  // 重复落子
  g.turn = BLACK; // 强制切回黑方测试
  const r2 = g.placeStone(7, 7);
  assert(!r2.success, '重复位置应失败');

  // 越界落子
  const r3 = g.placeStone(-1, 0);
  assert(!r3.success, '越界落子应失败');
  const r4 = g.placeStone(15, 0);
  assert(!r4.success, '越界落子应失败(15)');
}

// ========== 内力系统测试 ==========
console.log('\n=== 3. 内力系统测试 ===');
{
  const g = new SkillGomoku();

  // 每步+5
  g.placeStone(0, 0); // 黑 +5
  assertEqual(g.mp[BLACK], 5, '第1步黑方内力应为5');

  g.placeStone(0, 1); // 白 +5
  assertEqual(g.mp[WHITE], 5, '第1步白方内力应为5');

  // 测试内力上限200
  g.mp[BLACK] = 198;
  g.turn = BLACK;
  g.placeStone(1, 0); // 黑 198+5=203 → 200
  assertEqual(g.mp[BLACK], 200, '内力应被限制在200');
}

// ========== 胜负判定测试 ==========
console.log('\n=== 4. 胜负判定测试 ===');
{
  // 横向5连
  const g1 = new SkillGomoku();
  g1.board[7][3] = BLACK;
  g1.board[7][4] = BLACK;
  g1.board[7][5] = BLACK;
  g1.board[7][6] = BLACK;
  g1.turn = BLACK;
  const r1 = g1.placeStone(7, 7);
  assert(r1.gameOver, '横向5连应结束游戏');
  assertEqual(r1.winner, BLACK, '横向5连黑方应获胜');

  // 纵向5连
  const g2 = new SkillGomoku();
  g2.board[3][7] = WHITE;
  g2.board[4][7] = WHITE;
  g2.board[5][7] = WHITE;
  g2.board[6][7] = WHITE;
  g2.turn = WHITE;
  const r2 = g2.placeStone(7, 7);
  assert(r2.gameOver, '纵向5连应结束游戏');
  assertEqual(r2.winner, WHITE, '纵向5连白方应获胜');

  // 对角线5连
  const g3 = new SkillGomoku();
  g3.board[3][3] = BLACK;
  g3.board[4][4] = BLACK;
  g3.board[5][5] = BLACK;
  g3.board[6][6] = BLACK;
  g3.turn = BLACK;
  const r3 = g3.placeStone(7, 7);
  assert(r3.gameOver, '对角线5连应结束游戏');

  // 反对角线5连
  const g4 = new SkillGomoku();
  g4.board[3][7] = BLACK;
  g4.board[4][6] = BLACK;
  g4.board[5][5] = BLACK;
  g4.board[6][4] = BLACK;
  g4.turn = BLACK;
  const r4 = g4.placeStone(7, 3);
  assert(r4.gameOver, '反对角线5连应结束游戏');

  // 4连不应获胜
  const g5 = new SkillGomoku();
  g5.board[7][3] = BLACK;
  g5.board[7][4] = BLACK;
  g5.board[7][5] = BLACK;
  g5.turn = BLACK;
  const r5 = g5.placeStone(7, 6);
  assert(!r5.gameOver, '4连不应结束游戏');
}

// ========== 禁手测试 ==========
console.log('\n=== 5. 禁手测试 ===');
{
  // 长连禁手 (6连)
  const g1 = new SkillGomoku();
  g1.board[7][2] = BLACK;
  g1.board[7][3] = BLACK;
  g1.board[7][4] = BLACK;
  g1.board[7][5] = BLACK;
  g1.board[7][6] = BLACK;
  g1.turn = BLACK;
  const r1 = g1.placeStone(7, 7);
  assert(r1.gameOver, '6连应结束游戏');
  assertEqual(r1.winner, WHITE, '6连禁手黑方应判负');
  assert(r1.forbidden === true, '应标记为禁手');

  // 白方无禁手
  const g2 = new SkillGomoku();
  g2.board[7][2] = WHITE;
  g2.board[7][3] = WHITE;
  g2.board[7][4] = WHITE;
  g2.board[7][5] = WHITE;
  g2.board[7][6] = WHITE;
  g2.turn = WHITE;
  const r2 = g2.placeStone(7, 7);
  assert(r2.gameOver, '白方6连应结束游戏');
  assertEqual(r2.winner, WHITE, '白方6连应获胜(无禁手)');

  // 5连优先于禁手
  const g3 = new SkillGomoku();
  // 构造一个既能形成5连又可能触发禁手的场景
  g3.board[7][3] = BLACK;
  g3.board[7][4] = BLACK;
  g3.board[7][5] = BLACK;
  g3.board[7][6] = BLACK;
  g3.turn = BLACK;
  const r3 = g3.placeStone(7, 7);
  assertEqual(r3.winner, BLACK, '5连应优先于禁手判定');
}

// ========== 技能1: 时光倒流 ==========
console.log('\n=== 6. 技能1: 时光倒流 ===');
{
  const g = new SkillGomoku();
  g.placeStone(7, 7); // 黑下
  g.placeStone(7, 8); // 白下

  // 设置足够内力
  g.mp[BLACK] = 50;
  g.turn = BLACK;

  const r = g.activateSkill(1);
  assert(r.success, '技能1应直接生效');
  assertEqual(g.board[7][8], EMPTY, '技能1应撤销最后一步(白子)');

  // 无步可悔
  const g2 = new SkillGomoku();
  g2.mp[BLACK] = 50;
  const r2 = g2.activateSkill(1);
  assert(!r2.success, '无步可悔时技能1应失败');
  assertEqual(g2.mp[BLACK], 50, '失败时应退还内力');
}

// ========== 技能2: 力拔山兮 ==========
console.log('\n=== 7. 技能2: 力拔山兮 ===');
{
  const g = new SkillGomoku();
  g.mp[BLACK] = 100;

  // 放置一些棋子
  g.board[7][7] = BLACK;
  g.board[6][7] = WHITE;
  g.board[8][7] = WHITE;
  g.board[7][6] = BLACK;
  g.board[7][8] = WHITE;

  const r1 = g.activateSkill(2);
  assert(r1.needTarget, '技能2应需要目标');
  assertEqual(g.currentSkill, 2, '应设置当前技能为2');

  const r2 = g.useSkill(2, 7, 7);
  assert(r2.success, '技能2应成功');
  assertEqual(g.board[7][7], EMPTY, '中心应被清除');
  assertEqual(g.board[6][7], EMPTY, '上方应被清除');
  assertEqual(g.board[8][7], EMPTY, '下方应被清除');
  assertEqual(g.board[7][6], EMPTY, '左方应被清除');
  assertEqual(g.board[7][8], EMPTY, '右方应被清除');
}

// ========== 技能3: 飞沙走石 ==========
console.log('\n=== 8. 技能3: 飞沙走石 ===');
{
  const g = new SkillGomoku();
  g.mp[BLACK] = 200;
  g.board[7][7] = WHITE; // 放一个敌子

  const r1 = g.activateSkill(3);
  assert(r1.needTarget, '技能3应需要目标');

  // 第一步: 选择敌子
  const r2 = g.useSkill(3, 7, 7);
  assert(r2.success, '选择敌子应成功');
  assert(r2.needSecondTarget, '应需要第二步');

  // ⚠️ BUG测试: 第二步会再次扣除内力
  const mpBefore = g.mp[BLACK];
  const r3 = g.useSkill(3, 5, 5);
  assert(r3.success, '移动应成功');
  assertEqual(g.board[7][7], EMPTY, '原位置应为空');
  assertEqual(g.board[5][5], WHITE, '目标位置应有白子');

  // 检查是否被双重扣费
  const expectedMp = mpBefore - 70; // 如果被扣了第二次
  console.log(`  ⚠️ 技能3双重扣费检测: 执行前MP=${mpBefore}, 执行后MP=${g.mp[BLACK]}, 差值=${mpBefore - g.mp[BLACK]}`);
  if (g.mp[BLACK] !== mpBefore) {
    console.log('  🐛 BUG确认: 技能3第二步额外扣除了内力!');
  }

  // 选择空位应失败
  const g2 = new SkillGomoku();
  g2.mp[BLACK] = 200;
  g2.activateSkill(3);
  const r4 = g2.useSkill(3, 5, 5);
  assert(!r4.success, '选择空位应失败');

  // 选择己方棋子应失败
  const g3 = new SkillGomoku();
  g3.mp[BLACK] = 200;
  g3.board[5][5] = BLACK;
  g3.activateSkill(3);
  const r5 = g3.useSkill(3, 5, 5);
  assert(!r5.success, '选择己方棋子应失败');
}

// ========== 技能4: 静如止水 ==========
console.log('\n=== 9. 技能4: 静如止水 ===');
{
  const g = new SkillGomoku();
  g.mp[BLACK] = 200;

  const r = g.activateSkill(4);
  assert(r.success, '技能4应成功');
  assert(g.skipNextTurn, 'skipNextTurn应为true');
  assertEqual(g.mp[BLACK], 100, '技能4应扣除100内力');
}

// ========== 技能5: 东山再起 ==========
console.log('\n=== 10. 技能5: 东山再起 ===');
{
  const g = new SkillGomoku();
  g.mp[BLACK] = 200;
  g.board[7][7] = BLACK;
  g.board[7][8] = WHITE;
  g.moveCount = 2;

  const r = g.activateSkill(5);
  assert(r.success, '技能5应成功');
  assertEqual(g.board[7][7], EMPTY, '棋盘应被清空');
  assertEqual(g.board[7][8], EMPTY, '棋盘应被清空');
  assertEqual(g.moveCount, 0, '步数应重置');
  assertEqual(g.mp[BLACK], 0, '内力应扣除200');
}

// ========== 内力不足测试 ==========
console.log('\n=== 11. 内力不足测试 ===');
{
  const g = new SkillGomoku();
  g.mp[BLACK] = 0;

  const r1 = g.activateSkill(1);
  assert(!r1.success, '0内力使用技能1应失败');

  g.mp[BLACK] = 29;
  const r2 = g.activateSkill(1);
  assert(!r2.success, '29内力使用技能1(cost=30)应失败');

  g.mp[BLACK] = 30;
  // 但没有历史记录
  const r3 = g.activateSkill(1);
  assert(!r3.success, '有内力但无历史记录,技能1应失败');
}

// ========== AI下棋测试 ==========
console.log('\n=== 12. AI下棋测试 ===');
{
  const g = new SkillGomoku();
  g.turn = WHITE;

  const r = g.aiMove();
  assert(r.success, 'AI应能成功下棋');
  assertEqual(g.turn, BLACK, 'AI下棋后应切换为黑方');

  // AI不在自己回合不应下棋
  const g2 = new SkillGomoku();
  g2.turn = BLACK;
  const r2 = g2.aiMove();
  assert(!r2.success, '非AI回合不应下棋');
}

// ========== AI评估函数测试 ==========
console.log('\n=== 13. AI评估函数测试 ===');
{
  const g = new SkillGomoku();

  // 空棋盘评分应为0
  assertEqual(g.evaluate(7, 7, BLACK), 0, '空棋盘评分应为0');

  // 有连子时评分应更高
  g.board[7][6] = BLACK;
  const score1 = g.evaluate(7, 7, BLACK);
  assert(score1 > 0, '相邻有己方棋子时评分应>0');

  g.board[7][5] = BLACK;
  const score2 = g.evaluate(7, 7, BLACK);
  assert(score2 > score1, '更多连子评分应更高');

  g.board[7][4] = BLACK;
  const score3 = g.evaluate(7, 7, BLACK);
  assert(score3 > score2, '4连评分应更高');

  g.board[7][3] = BLACK;
  const score4 = g.evaluate(7, 7, BLACK);
  assert(score4 >= 10000, '5连评分应>=10000');
}

// ========== switchTurn + skipNextTurn 测试 ==========
console.log('\n=== 14. 回合切换测试 ===');
{
  const g = new SkillGomoku();
  g.turn = BLACK;
  g.switchTurn();
  assertEqual(g.turn, WHITE, '黑方切换后应为白方');

  g.switchTurn();
  assertEqual(g.turn, BLACK, '白方切换后应为黑方');

  // skipNextTurn测试
  g.turn = BLACK;
  g.skipNextTurn = true;
  g.switchTurn();
  assertEqual(g.turn, BLACK, 'skipNextTurn时不应切换');
  assertEqual(g.skipNextTurn, false, 'skipNextTurn应被重置');
}

// ========== AI技能使用逻辑测试 ==========
console.log('\n=== 15. AI技能使用逻辑分析 ===');
{
  // 测试AI使用技能3(飞沙走石)的问题
  const g = new SkillGomoku();
  g.turn = WHITE;
  g.mp[WHITE] = 100;

  // 构造一个威胁点场景
  g.board[7][5] = BLACK;
  g.board[7][6] = BLACK;
  g.board[7][8] = BLACK;
  // 7,7是威胁点(空位)

  // AI调用useSkill(3, threatRow, threatCol) 其中threat是空位
  // 技能3第一步要求选择敌方棋子,空位会失败
  const r = g.useSkill(3, 7, 7);
  console.log(`  ⚠️ AI技能3对空位的结果: success=${r.success}, message=${r.message}`);
  assert(!r.success, 'AI对空位使用技能3应失败');
}

// ========== reset方法一致性测试 ==========
console.log('\n=== 16. reset方法一致性 ===');
{
  const g = new SkillGomoku();
  g.reset();
  // reset()设置MP为30, 但initGame设置为0
  assertEqual(g.mp[BLACK], 30, 'reset()设置黑方MP为30');
  assertEqual(g.mp[WHITE], 30, 'reset()设置白方MP为30');
  console.log('  ⚠️ 注意: reset()设MP=30, 但initGame()设MP=0, 存在不一致');
}

// ========== 技能1悔棋后回合切换测试 ==========
console.log('\n=== 17. 技能1悔棋回合逻辑 ===');
{
  const g = new SkillGomoku();
  g.placeStone(7, 7); // 黑下, turn→WHITE
  g.placeStone(7, 8); // 白下, turn→BLACK

  // 黑方使用技能1
  g.mp[BLACK] = 50;
  g.turn = BLACK;
  const turnBefore = g.turn;
  g.activateSkill(1); // 悔棋, 撤销白子7,8

  // 技能1内部调用switchTurn, BLACK→WHITE
  console.log(`  悔棋前turn=${turnBefore}, 悔棋后turn=${g.turn}`);
  // 悔棋后应该还是玩家回合才合理,但实际会切换为WHITE
  if (g.turn === WHITE) {
    console.log('  ⚠️ 技能1悔棋后切换为对方回合,玩家无法继续操作');
  }
}

// ========== 总结 ==========
console.log('\n' + '='.repeat(50));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
if (failures.length > 0) {
  console.log('\n失败的测试:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log('='.repeat(50));
