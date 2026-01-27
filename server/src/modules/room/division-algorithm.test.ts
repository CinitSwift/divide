
// Mock 类型定义
interface MockUser {
  nickname: string;
}

interface MockRoomMember {
  id: string;
  userId: string;
  labels: string[];
  user: MockUser;
}

interface LabelRulesConfig {
  [key: string]: 'none' | 'even' | 'same_team' | undefined;
}

interface DivisionOptions {
  debug?: boolean;
}

interface DivisionLog {
  step: number;
  action: string;
  description: string;
  teamA: string[];
  teamB: string[];
  score?: number;
}

interface DivisionResultInternal {
  teamA: MockRoomMember[];
  teamB: MockRoomMember[];
  logs?: DivisionLog[];
}

/**
 * 计算分队方案的不平衡分数（越低越好）
 */
function calculateScore(
  teamA: MockRoomMember[],
  teamB: MockRoomMember[],
  evenLabels: string[],
): number {
  let score = 0;

  // 1. 标签不平衡惩罚 (权重 5)
  for (const label of evenLabels) {
    const countA = teamA.filter((m) => m.labels?.includes(label)).length;
    const countB = teamB.filter((m) => m.labels?.includes(label)).length;
    score += Math.abs(countA - countB) * 5;
  }

  // 2. 人数不平衡惩罚 (权重 3)
  score += Math.abs(teamA.length - teamB.length) * 3;

  return score;
}

/**
 * CSP 精确求解：枚举所有 2^n 种分配，找到最优解
 */
function solveWithCSP(
  members: MockRoomMember[],
  evenLabels: string[],
  sameTeamLabel: string | null,
  protectedAssignment: { teamA: MockRoomMember[]; teamB: MockRoomMember[] } | null,
  debug: boolean = false,
): DivisionResultInternal {
  const logs: DivisionLog[] = [];
  const n = members.length;

  if (n === 0 && protectedAssignment) {
    return {
      teamA: [...protectedAssignment.teamA],
      teamB: [...protectedAssignment.teamB],
      logs: debug ? logs : undefined,
    };
  }

  let bestResult: { teamA: MockRoomMember[]; teamB: MockRoomMember[] } | null = null;
  let bestScore = Infinity;

  const totalCombinations = 1 << n;

  for (let mask = 0; mask < totalCombinations; mask++) {
    const teamA: MockRoomMember[] = protectedAssignment ? [...protectedAssignment.teamA] : [];
    const teamB: MockRoomMember[] = protectedAssignment ? [...protectedAssignment.teamB] : [];

    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) {
        teamA.push(members[i]);
      } else {
        teamB.push(members[i]);
      }
    }

    if (sameTeamLabel) {
      const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
      const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
      if (inA && inB) continue;
    }

    const score = calculateScore(teamA, teamB, evenLabels);

    if (score < bestScore) {
      bestScore = score;
      bestResult = { teamA: [...teamA], teamB: [...teamB] };
    }
  }

  if (debug && bestResult) {
    logs.push({
      step: 1,
      action: 'final',
      description: `CSP found optimal solution with score ${bestScore}`,
      teamA: bestResult.teamA.map((m) => m.user?.nickname || m.userId),
      teamB: bestResult.teamB.map((m) => m.user?.nickname || m.userId),
      score: bestScore,
    });
  }

  return bestResult
    ? { ...bestResult, logs: debug ? logs : undefined }
    : { teamA: [], teamB: [], logs: debug ? logs : undefined };
}

/**
 * 贪心 + 2-opt 局部优化算法
 */
function greedyWithTwoOpt(
  members: MockRoomMember[],
  evenLabels: string[],
  sameTeamLabel: string | null,
  protectedAssignment: { teamA: MockRoomMember[]; teamB: MockRoomMember[] } | null,
  debug: boolean = false,
  maxIterations: number = 100,
): DivisionResultInternal {
  const logs: DivisionLog[] = [];

  const teamA: MockRoomMember[] = protectedAssignment ? [...protectedAssignment.teamA] : [];
  const teamB: MockRoomMember[] = protectedAssignment ? [...protectedAssignment.teamB] : [];
  const protectedIds = new Set([...teamA, ...teamB].map((m) => m.id));

  const remaining: MockRoomMember[] = [];
  let sameTeamTarget: 'A' | 'B' | null = null;

  if (sameTeamLabel) {
    const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
    const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
    if (inA) sameTeamTarget = 'A';
    else if (inB) sameTeamTarget = 'B';
    else sameTeamTarget = Math.random() < 0.5 ? 'A' : 'B';
  }

  for (const member of members) {
    if (protectedIds.has(member.id)) continue;

    if (sameTeamLabel && member.labels?.includes(sameTeamLabel)) {
      if (sameTeamTarget === 'A') {
        teamA.push(member);
      } else {
        teamB.push(member);
      }
      protectedIds.add(member.id);
    } else {
      remaining.push(member);
    }
  }

  remaining.sort((a, b) => {
    const aCount = (a.labels || []).filter((l) => evenLabels.includes(l)).length;
    const bCount = (b.labels || []).filter((l) => evenLabels.includes(l)).length;
    return bCount - aCount;
  });

  for (const member of remaining) {
    const scoreIfA = calculateScore([...teamA, member], teamB, evenLabels);
    const scoreIfB = calculateScore(teamA, [...teamB, member], evenLabels);

    if (scoreIfA <= scoreIfB) {
      teamA.push(member);
    } else {
      teamB.push(member);
    }
  }

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    const currentScore = calculateScore(teamA, teamB, evenLabels);

    outerLoop: for (let i = 0; i < teamA.length; i++) {
      if (protectedIds.has(teamA[i].id)) continue;

      for (let j = 0; j < teamB.length; j++) {
        if (protectedIds.has(teamB[j].id)) continue;

        [teamA[i], teamB[j]] = [teamB[j], teamA[i]];

        if (sameTeamLabel) {
          const inA = teamA.some((m) => m.labels?.includes(sameTeamLabel));
          const inB = teamB.some((m) => m.labels?.includes(sameTeamLabel));
          if (inA && inB) {
            [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
            continue;
          }
        }

        const newScore = calculateScore(teamA, teamB, evenLabels);

        if (newScore < currentScore) {
          improved = true;
          break outerLoop;
        } else {
          [teamA[i], teamB[j]] = [teamB[j], teamA[i]];
        }
      }
    }
  }

  return { teamA, teamB, logs: debug ? logs : undefined };
}

/**
 * 主入口函数
 */
function divideWithRules(
  members: MockRoomMember[],
  labelRules: LabelRulesConfig,
  options: DivisionOptions = {},
): DivisionResultInternal {
  const { debug = false } = options;
  const logs: DivisionLog[] = [];

  if (members.length === 0) {
    return { teamA: [], teamB: [], logs: debug ? logs : undefined };
  }
  if (members.length === 1) {
    return { teamA: [members[0]], teamB: [], logs: debug ? logs : undefined };
  }

  const evenLabels = Object.entries(labelRules)
    .filter(([_, rule]) => String(rule) === 'even')
    .map(([label]) => label);

  const sameTeamLabel =
    Object.entries(labelRules).find(([_, rule]) => String(rule) === 'same_team')?.[0] || null;

  let protectedAssignment: { teamA: MockRoomMember[]; teamB: MockRoomMember[] } | null = null;
  const remainingMembers: MockRoomMember[] = [];

  const weiRuiMember = members.find((m) => m.user?.nickname === '葳蕤');
  const tuZiMember = members.find((m) => m.user?.nickname === '兔子');
  const hasSpecialPair = weiRuiMember && tuZiMember;
  const specialPairSameTeam = hasSpecialPair && Math.random() < 0.9;

  if (hasSpecialPair && specialPairSameTeam) {
    const goToTeamA = Math.random() < 0.5;
    protectedAssignment = goToTeamA
      ? { teamA: [weiRuiMember, tuZiMember], teamB: [] }
      : { teamA: [], teamB: [weiRuiMember, tuZiMember] };

    for (const member of members) {
      if (member !== weiRuiMember && member !== tuZiMember) {
        remainingMembers.push(member);
      }
    }
  } else {
    remainingMembers.push(...members);
  }

  const swappableCount = remainingMembers.length;

  if (swappableCount <= 12) {
    return solveWithCSP(remainingMembers, evenLabels, sameTeamLabel, protectedAssignment, debug);
  } else {
    return greedyWithTwoOpt(remainingMembers, evenLabels, sameTeamLabel, protectedAssignment, debug);
  }
}

// 测试数据生成辅助
function createMember(id: string, nickname: string, labels: string[] = []): MockRoomMember {
  return {
    id,
    userId: id,
    labels,
    user: { nickname },
  };
}

// 测试场景
async function runTests() {
  console.log('🚀 开始分边算法测试...\n');

  // 1. basicBalance: 8人4个god, even规则
  console.log('--- Scenario 1: basicBalance ---');
  const members1 = [
    createMember('1', 'A', ['god']),
    createMember('2', 'B', ['god']),
    createMember('3', 'C', ['god']),
    createMember('4', 'D', ['god']),
    createMember('5', 'E'),
    createMember('6', 'F'),
    createMember('7', 'G'),
    createMember('8', 'H'),
  ];
  const rules1: LabelRulesConfig = { god: 'even' };
  const res1 = divideWithRules(members1, rules1);
  printResult(res1, rules1);

  // 2. sameTeam: 6人2个boss, same_team规则
  console.log('\n--- Scenario 2: sameTeam ---');
  const members2 = [
    createMember('1', 'Boss1', ['boss']),
    createMember('2', 'Boss2', ['boss']),
    createMember('3', 'P1'),
    createMember('4', 'P2'),
    createMember('5', 'P3'),
    createMember('6', 'P4'),
  ];
  const rules2: LabelRulesConfig = { boss: 'same_team' };
  const res2 = divideWithRules(members2, rules2);
  printResult(res2, rules2);

  // 3. multiLabel: 10人多标签
  console.log('\n--- Scenario 3: multiLabel ---');
  const members3 = [
    createMember('1', 'M1', ['god', 'pro']),
    createMember('2', 'M2', ['god']),
    createMember('3', 'M3', ['pro']),
    createMember('4', 'M4', ['god']),
    createMember('5', 'M5', ['pro']),
    ...Array.from({ length: 5 }, (_, i) => createMember(String(i + 6), `Normal${i + 1}`)),
  ];
  const rules3: LabelRulesConfig = { god: 'even', pro: 'even' };
  const res3 = divideWithRules(members3, rules3);
  printResult(res3, rules3);

  // 4. oddNumber: 5人奇数
  console.log('\n--- Scenario 4: oddNumber ---');
  const members4 = Array.from({ length: 5 }, (_, i) => createMember(String(i + 1), `P${i + 1}`, i < 2 ? ['god'] : []));
  const rules4: LabelRulesConfig = { god: 'even' };
  const res4 = divideWithRules(members4, rules4);
  printResult(res4, rules4);

  // 5. hiddenRule: 包含"葳蕤"和"兔子"
  console.log('\n--- Scenario 5: hiddenRule (葳蕤 + 兔子) ---');
  const members5 = [
    createMember('1', '葳蕤'),
    createMember('2', '兔子'),
    createMember('3', 'P3'),
    createMember('4', 'P4'),
    createMember('5', 'P5'),
    createMember('6', 'P6'),
  ];
  const rules5: LabelRulesConfig = {};
  console.log('Running 10 times to check probability...');
  let sameTeamCount = 0;
  for (let i = 0; i < 10; i++) {
    const res5 = divideWithRules(members5, rules5);
    const inA = res5.teamA.some(m => ['葳蕤', '兔子'].includes(m.user.nickname));
    const bothInA = res5.teamA.filter(m => ['葳蕤', '兔子'].includes(m.user.nickname)).length === 2;
    const bothInB = res5.teamB.filter(m => ['葳蕤', '兔子'].includes(m.user.nickname)).length === 2;
    if (bothInA || bothInB) sameTeamCount++;
  }
  console.log(`葳蕤 and 兔子 in same team: ${sameTeamCount}/10 times (Expected ~90%)`);

  // 6. largeScale: 15人触发贪心
  console.log('\n--- Scenario 6: largeScale (15 members) ---');
  const members6 = Array.from({ length: 15 }, (_, i) => 
    createMember(String(i + 1), `User${i + 1}`, i < 6 ? ['veteran'] : [])
  );
  const rules6: LabelRulesConfig = { veteran: 'even' };
  const res6 = divideWithRules(members6, rules6);
  printResult(res6, rules6);

  console.log('\n✅ 所有测试完成!');
}

function printResult(result: DivisionResultInternal, rules: LabelRulesConfig) {
  const formatTeam = (team: MockRoomMember[]) =>
    team.map((m) => `${m.user.nickname}(${m.labels.join(',')})`).join(', ');

  console.log(`Team A (${result.teamA.length}): ${formatTeam(result.teamA)}`);
  console.log(`Team B (${result.teamB.length}): ${formatTeam(result.teamB)}`);
  
  const evenLabels = Object.entries(rules).filter(([_, r]) => r === 'even').map(([l]) => l);
  for (const label of evenLabels) {
    const countA = result.teamA.filter(m => m.labels.includes(label)).length;
    const countB = result.teamB.filter(m => m.labels.includes(label)).length;
    console.log(`  Label [${label}] balance: A=${countA}, B=${countB}`);
  }
  
  const sameTeamLabel = Object.entries(rules).find(([_, r]) => r === 'same_team')?.[0];
  if (sameTeamLabel) {
    const inA = result.teamA.some(m => m.labels.includes(sameTeamLabel));
    const inB = result.teamB.some(m => m.labels.includes(sameTeamLabel));
    console.log(`  Label [${sameTeamLabel}] same team check: ${inA && inB ? '❌ FAILED' : '✅ PASSED'}`);
  }
}

runTests().catch(console.error);
