export type Position = 'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP' | 'ALL' | 'NONE';

export type TierRank =
  | 'CHALLENGER'
  | 'GRANDMASTER'
  | 'MASTER'
  | 'DIAMOND_1_2'
  | 'DIAMOND_3_4'
  | 'EMERALD_1_2'
  | 'EMERALD_3_4'
  | 'PLATINUM'
  | 'GOLD'
  | 'SILVER'
  | 'BRONZE'
  | 'IRON';

export interface TierInfo {
  key: TierRank;
  label: string;
  shortLabel: string;
  points: number;
  color: string;
  bg: string;
  badgeBg: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  tier: TierRank;
  mainPos: Position;
  subPos?: Position;
  note?: string;
}

export interface TeamAssignment {
  player: LobbyPlayer;
  assignedPos: 'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP';
  isOffRole: boolean; // playing outside main/sub
  roleType?: 'MAIN' | 'SUB' | 'FLEX' | 'OFF';
  effectivePoints?: number;
}

export interface BalancedMatch {
  id: string;
  label: string;
  blueTeam: Record<'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP', TeamAssignment>;
  redTeam: Record<'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP', TeamAssignment>;
  bluePoints: number;
  redPoints: number;
  pointDiff: number;
  blueEffectivePoints?: number;
  redEffectivePoints?: number;
  effectivePointDiff?: number;
  offRoleCount: number;
  subRoleCount?: number;
  grade: 'PERFECT' | 'GREAT' | 'ACCEPTABLE' | 'UNBALANCED';
}
