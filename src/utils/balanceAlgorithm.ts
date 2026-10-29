import { LobbyPlayer, BalancedMatch, TeamAssignment, Position } from '../types';
import { TIER_CONFIG } from '../data/tierConfig';

type Lane = 'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP';
const LANES: Lane[] = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];

export function getPlayerRawPoints(player: LobbyPlayer): number {
  return TIER_CONFIG[player.tier]?.points ?? 4;
}

// Calculates effective combat power based on assigned role (Main 100%, Sub ~90%, Off-role ~82%)
// User benchmark: Emerald 1~2 (11 points) twisted/off-role gets ~2 points deducted.
export function getPlayerEffectivePoints(
  rawPoints: number,
  assignedLane: Lane,
  mainPos: Position,
  subPos?: Position
): { effectivePoints: number; deduction: number; roleType: 'MAIN' | 'SUB' | 'FLEX' | 'OFF'; isOff: boolean } {
  if (mainPos === assignedLane) {
    return { effectivePoints: rawPoints, deduction: 0, roleType: 'MAIN', isOff: false };
  }
  if (mainPos === 'ALL') {
    return { effectivePoints: rawPoints, deduction: 0, roleType: 'FLEX', isOff: false };
  }
  if (subPos === assignedLane || subPos === 'ALL') {
    // Sub-position: mild point deduction (~9%, ~1 pt for 11pt Emerald)
    const rawDeduct = Math.max(0.5, Math.round(rawPoints * 0.09 * 10) / 10);
    const deduction = Math.round(rawDeduct * 2) / 2; // increments of 0.5
    const effective = Math.max(0.5, Math.round((rawPoints - deduction) * 10) / 10);
    return { effectivePoints: effective, deduction, roleType: 'SUB', isOff: false };
  }

  // Off-role / Twisted lane:
  // When subPos is 'NONE' (single-lane only, other roles impossible): deduct 5 points as requested!
  if (subPos === 'NONE') {
    const rawDeduct = 5.0;
    // Ensure effective points do not drop below minimum 0.5
    const deduction = Math.min(rawDeduct, Math.max(0.5, Math.round((rawPoints - 0.5) * 10) / 10));
    const effective = Math.max(0.5, Math.round((rawPoints - deduction) * 10) / 10);
    return { effectivePoints: effective, deduction, roleType: 'OFF', isOff: true };
  }

  // Standard off-role: ~18% deduction (~2.0 pts for 11pt Emerald 1~2, matching user requirement)
  const rawDeduct = Math.max(1.0, Math.round(rawPoints * 0.18 * 10) / 10);
  const deduction = Math.round(rawDeduct * 2) / 2; // increments of 0.5 (e.g. 1.0, 1.5, 2.0, 2.5, 3.0)
  const effective = Math.max(0.5, Math.round((rawPoints - deduction) * 10) / 10);
  return { effectivePoints: effective, deduction, roleType: 'OFF', isOff: true };
}

// Optimal assignment of 5 players to 5 lanes maximizing position preference
function assignLanesToTeam(players: LobbyPlayer[]): {
  roster: Record<Lane, TeamAssignment>;
  penalty: number;
  offRoles: number;
  subRoles: number;
  totalEffectivePoints: number;
} {
  let bestRoster: Record<Lane, TeamAssignment> | null = null;
  let minPenalty = Infinity;
  let minOffRoles = Infinity;
  let minSubRoles = Infinity;
  let bestEffectivePoints = 0;

  function permute(arr: LobbyPlayer[], m: LobbyPlayer[] = []) {
    if (arr.length === 0) {
      evaluateAssignment(m);
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  }

  function evaluateAssignment(candidate: LobbyPlayer[]) {
    let penalty = 0;
    let offRoles = 0;
    let subRoles = 0;
    let totalEff = 0;
    const tempRoster = {} as Record<Lane, TeamAssignment>;

    for (let i = 0; i < 5; i++) {
      const lane = LANES[i];
      const player = candidate[i];
      const rawPoints = getPlayerRawPoints(player);
      const { effectivePoints, deduction, roleType, isOff } = getPlayerEffectivePoints(
        rawPoints,
        lane,
        player.mainPos,
        player.subPos
      );

      totalEff += effectivePoints;

      if (roleType === 'MAIN') {
        penalty += 0;
      } else if (roleType === 'FLEX') {
        penalty += 0.5;
      } else if (roleType === 'SUB') {
        penalty += 2.0;
        subRoles += 1;
      } else {
        // Off-role: if player has subPos === 'NONE' (one-lane only), heavily penalize off-role
        penalty += (player.subPos === 'NONE' ? 35.0 : 15.0);
        offRoles += 1;
      }

      tempRoster[lane] = {
        player,
        assignedPos: lane,
        isOffRole: isOff,
        roleType,
        effectivePoints,
        deduction,
      };
    }

    if (penalty < minPenalty) {
      minPenalty = penalty;
      minOffRoles = offRoles;
      minSubRoles = subRoles;
      bestRoster = tempRoster;
      bestEffectivePoints = Math.round(totalEff * 10) / 10;
    }
  }

  permute(players);

  return {
    roster: bestRoster!,
    penalty: minPenalty,
    offRoles: minOffRoles,
    subRoles: minSubRoles,
    totalEffectivePoints: bestEffectivePoints,
  };
}

function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, combo: T[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return result;
}

export function computeBestBalancedMatch(players: LobbyPlayer[]): BalancedMatch | null {
  if (players.length !== 10) return null;

  // 10 choose 5 = 252 (126 unique partitions)
  const allTeamA = combinations(players, 5);
  // Guarantee unique pairs by fixing players[0] in blue team
  const uniqueTeamA = allTeamA.filter((team) => team.some((p) => p.id === players[0].id));

  let bestMatch: BalancedMatch | null = null;
  let lowestLoss = Infinity;

  // Exhaustive search across all 126 combinations
  for (let i = 0; i < uniqueTeamA.length; i++) {
    const blue = uniqueTeamA[i];
    const blueIds = new Set(blue.map((p) => p.id));
    const red = players.filter((p) => !blueIds.has(p.id));

    const blueRawPoints = blue.reduce((sum, p) => sum + getPlayerRawPoints(p), 0);
    const redRawPoints = red.reduce((sum, p) => sum + getPlayerRawPoints(p), 0);
    const rawPointDiff = Math.abs(blueRawPoints - redRawPoints);

    // Find optimal lane assignment for both teams
    const blueAssign = assignLanesToTeam(blue);
    const redAssign = assignLanesToTeam(red);

    const totalOffRoles = blueAssign.offRoles + redAssign.offRoles;
    const totalSubRoles = blueAssign.subRoles + redAssign.subRoles;

    const blueEff = blueAssign.totalEffectivePoints;
    const redEff = redAssign.totalEffectivePoints;
    const effPointDiff = Math.round(Math.abs(blueEff - redEff) * 10) / 10;

    // Calculate lane-by-lane matchup gaps
    let laneDiffSum = 0;
    let maxLaneDiff = 0;

    for (const lane of LANES) {
      const bEff = blueAssign.roster[lane].effectivePoints ?? getPlayerRawPoints(blueAssign.roster[lane].player);
      const rEff = redAssign.roster[lane].effectivePoints ?? getPlayerRawPoints(redAssign.roster[lane].player);
      const laneDiff = Math.abs(bEff - rEff);
      laneDiffSum += laneDiff;
      if (laneDiff > maxLaneDiff) {
        maxLaneDiff = laneDiff;
      }
    }

    // Comprehensive balance evaluation score (loss function, lower is better):
    // 1. Off-roles are strongly avoided (no one wants to play off-role in in-house)
    // 2. Effective team score difference (factors in role proficiency)
    // 3. Raw tier score difference
    // 4. Lane-by-lane direct matchup gaps (prevents stomp in one lane compensated by another)
    // 5. Maximum single lane gap (prevents extreme Master vs Silver mismatch)
    const lossScore =
      totalOffRoles * 35.0 +
      effPointDiff * 8.0 +
      rawPointDiff * 4.0 +
      totalSubRoles * 3.0 +
      laneDiffSum * 3.5 +
      maxLaneDiff * 4.5;

    if (lossScore < lowestLoss) {
      lowestLoss = lossScore;

      let grade: BalancedMatch['grade'] = 'PERFECT';
      if (rawPointDiff <= 2 && totalOffRoles === 0 && maxLaneDiff <= 4) {
        grade = 'PERFECT';
      } else if (rawPointDiff <= 4 && totalOffRoles <= 1 && maxLaneDiff <= 7) {
        grade = 'GREAT';
      } else if (rawPointDiff <= 7) {
        grade = 'ACCEPTABLE';
      } else {
        grade = 'UNBALANCED';
      }

      bestMatch = {
        id: 'best-match',
        label: '최적 황금 밸런스',
        blueTeam: blueAssign.roster,
        redTeam: redAssign.roster,
        bluePoints: blueRawPoints,
        redPoints: redRawPoints,
        pointDiff: rawPointDiff,
        blueEffectivePoints: blueEff,
        redEffectivePoints: redEff,
        effectivePointDiff: effPointDiff,
        offRoleCount: totalOffRoles,
        subRoleCount: totalSubRoles,
        grade,
      };
    }
  }

  // 총점 낮은 팀이 항상 블루팀으로 가도록 보정 (블루 진영 어드밴티지 및 유저 요청 반영)
  if (bestMatch) {
    const blueEff = bestMatch.blueEffectivePoints ?? bestMatch.bluePoints;
    const redEff = bestMatch.redEffectivePoints ?? bestMatch.redPoints;
    const blueIsHigher =
      blueEff > redEff ||
      (blueEff === redEff && bestMatch.bluePoints > bestMatch.redPoints);

    if (blueIsHigher) {
      bestMatch = {
        ...bestMatch,
        blueTeam: bestMatch.redTeam,
        redTeam: bestMatch.blueTeam,
        bluePoints: bestMatch.redPoints,
        redPoints: bestMatch.bluePoints,
        blueEffectivePoints: bestMatch.redEffectivePoints,
        redEffectivePoints: bestMatch.blueEffectivePoints,
      };
    }
  }

  return bestMatch;
}
