import { useState, useEffect, useMemo } from 'react';
import { LobbyPlayer, Position, TierRank, TeamAssignment } from './types';
import { TIER_CONFIG, POSITIONS, SUB_POSITIONS, INITIAL_10_PLAYERS } from './data/tierConfig';
import { computeBestBalancedMatch, getPlayerEffectivePoints, getPlayerRawPoints } from './utils/balanceAlgorithm';
import { FastPasteModal } from './components/FastPasteModal';
import { ImageExportModal } from './components/ImageExportModal';

type Lane = 'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP';
const LANES: Lane[] = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];

const LANE_KOREAN: Record<Lane, string> = {
  TOP: '탑',
  JUG: '정글',
  MID: '미드',
  ADC: '원딜',
  SUP: '서폿',
};

export default function App() {
  // Load initial players from localStorage or fallback
  const [players, setPlayers] = useState<LobbyPlayer[]>(() => {
    try {
      const saved = localStorage.getItem('lol_custom_5v5_players');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 10) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return INITIAL_10_PLAYERS;
  });

  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [isTierTableOpen, setIsTierTableOpen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Selected player for manual click-to-swap
  const [selectedSwapSlot, setSelectedSwapSlot] = useState<{
    team: 'blue' | 'red';
    lane: Lane;
  } | null>(null);

  // Save to localStorage whenever players change
  useEffect(() => {
    try {
      localStorage.setItem('lol_custom_5v5_players', JSON.stringify(players));
    } catch (e) {
      // ignore
    }
  }, [players]);

  // Compute the single best balanced match
  const bestMatch = useMemo(() => {
    return computeBestBalancedMatch(players);
  }, [players]);

  // Custom modified match state (allows manual drag/click swap overrides)
  const [customRoster, setCustomRoster] = useState<{
    blue: Record<Lane, TeamAssignment>;
    red: Record<Lane, TeamAssignment>;
  } | null>(null);

  // Sync custom roster when bestMatch updates
  useEffect(() => {
    if (bestMatch) {
      setCustomRoster({
        blue: { ...bestMatch.blueTeam },
        red: { ...bestMatch.redTeam },
      });
      setSelectedSwapSlot(null);
    }
  }, [bestMatch]);

  // Calculate live points from custom roster
  const activeBlueRoster = customRoster?.blue || bestMatch?.blueTeam;
  const activeRedRoster = customRoster?.red || bestMatch?.redTeam;

  const blueTotalPoints = useMemo(() => {
    if (!activeBlueRoster) return 0;
    return Object.values(activeBlueRoster).reduce(
      (sum, item) => sum + (TIER_CONFIG[item.player.tier]?.points ?? 4),
      0
    );
  }, [activeBlueRoster]);

  const redTotalPoints = useMemo(() => {
    if (!activeRedRoster) return 0;
    return Object.values(activeRedRoster).reduce(
      (sum, item) => sum + (TIER_CONFIG[item.player.tier]?.points ?? 4),
      0
    );
  }, [activeRedRoster]);

  const pointDiff = Math.abs(blueTotalPoints - redTotalPoints);

  // Grade calculation
  const getGradeInfo = (diff: number) => {
    if (diff <= 1.5) {
      return {
        label: '황금 밸런스',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        winRateText: '승률 예측 50% : 50% (완벽한 동등 매치)',
      };
    }
    if (diff <= 4) {
      return {
        label: '안정적 밸런스',
        color: 'text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/30',
        winRateText: '적절한 핸디캡 범위 내의 균형 잡힌 매치',
      };
    }
    if (diff <= 7) {
      return {
        label: '약우세 밸런스',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        winRateText: '특정 라인 캐리 필요 (약간의 전력 격차)',
      };
    }
    return {
      label: '밸런스 불균형 (재조정 권장)',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
      winRateText: '점수 차이가 커서 선수 교체 권장',
    };
  };

  const gradeInfo = getGradeInfo(pointDiff);

  // Manual player update in the 10-player table
  const handleUpdatePlayer = (
    id: string,
    field: keyof LobbyPlayer,
    value: any
  ) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Swap players between teams or lanes
  const handleSlotClick = (team: 'blue' | 'red', lane: Lane) => {
    if (!customRoster) return;

    if (!selectedSwapSlot) {
      // Select first slot
      setSelectedSwapSlot({ team, lane });
    } else {
      // If clicking the same slot, unselect
      if (selectedSwapSlot.team === team && selectedSwapSlot.lane === lane) {
        setSelectedSwapSlot(null);
        return;
      }

      // Perform swap
      const newCustom = {
        blue: { ...customRoster.blue },
        red: { ...customRoster.red },
      };

      const slot1Player = newCustom[selectedSwapSlot.team][selectedSwapSlot.lane].player;
      const slot2Player = newCustom[team][lane].player;

      const eff1 = getPlayerEffectivePoints(
        getPlayerRawPoints(slot2Player),
        selectedSwapSlot.lane,
        slot2Player.mainPos,
        slot2Player.subPos
      );

      const eff2 = getPlayerEffectivePoints(
        getPlayerRawPoints(slot1Player),
        lane,
        slot1Player.mainPos,
        slot1Player.subPos
      );

      // Swap players
      newCustom[selectedSwapSlot.team][selectedSwapSlot.lane] = {
        player: slot2Player,
        assignedPos: selectedSwapSlot.lane,
        isOffRole: eff1.isOff,
        roleType: eff1.roleType,
        effectivePoints: eff1.effectivePoints,
      };

      newCustom[team][lane] = {
        player: slot1Player,
        assignedPos: lane,
        isOffRole: eff2.isOff,
        roleType: eff2.roleType,
        effectivePoints: eff2.effectivePoints,
      };

      setCustomRoster(newCustom);
      setSelectedSwapSlot(null);

      setCopyToast('선수 포지션 맞교환이 완료되었습니다.');
      setTimeout(() => setCopyToast(null), 2000);
    }
  };

  const getRoleBadge = (slot: TeamAssignment) => {
    const p = slot.player;
    if (p.mainPos === slot.assignedPos || p.mainPos === 'ALL') {
      return null;
    }
    if (p.subPos === slot.assignedPos || p.subPos === 'ALL') {
      return (
        <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1 rounded font-medium">
          부포
        </span>
      );
    }
    return (
      <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1 rounded font-medium">
        오프롤
      </span>
    );
  };

  // Re-run the balance algorithm
  const handleRebalance = () => {
    const fresh = computeBestBalancedMatch(players);
    if (fresh) {
      setCustomRoster({
        blue: { ...fresh.blueTeam },
        red: { ...fresh.redTeam },
      });
      setSelectedSwapSlot(null);
      setCopyToast('최적 밸런스로 재배분되었습니다.');
      setTimeout(() => setCopyToast(null), 2000);
    }
  };


  // Reset to default sample players
  const handleResetSample = () => {
    setPlayers(INITIAL_10_PLAYERS);
    setCopyToast('기본 10인 명단으로 복원되었습니다.');
    setTimeout(() => setCopyToast(null), 2000);
  };

  // Clear all player entries
  const handleClearRoster = () => {
    const emptyRoster: LobbyPlayer[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p-new-${Date.now()}-${i}`,
      name: '',
      tier: 'GOLD',
      mainPos: 'ALL',
      subPos: 'ALL',
    }));
    setPlayers(emptyRoster);
    setCopyToast('참가자 명단이 전체 초기화되었습니다.');
    setTimeout(() => setCopyToast(null), 2000);
  };

  // Clear single player entry
  const handleResetSinglePlayer = (index: number) => {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              name: '',
              tier: 'GOLD',
              mainPos: 'ALL',
              subPos: 'ALL',
            }
          : p
      )
    );
    setCopyToast(`${index + 1}번 소환사가 초기화되었습니다.`);
    setTimeout(() => setCopyToast(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#090b10]/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-base sm:text-lg font-bold tracking-tight text-white">
              내전 밸런스 조절기
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsTierTableOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              포인트 환산 표
            </button>
            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              10명 일괄 붙여넣기
            </button>
            <button
              onClick={handleRebalance}
              className="px-3.5 py-2 text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg border border-sky-500/30 transition-colors whitespace-nowrap cursor-pointer"
            >
              밸런스 다시 맞추기
            </button>
            <button
              onClick={() => setIsImageModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-all shadow-md shadow-sky-500/20 whitespace-nowrap cursor-pointer"
            >
              이미지로 저장
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs shadow-2xl animate-bounce">
          {copyToast}
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Section 1: 5v5 Live Matchup Arena */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                최적 팀구성
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                주포지션과 부포지션을 최대한 반영한 최상의 밸런스입니다. 선수를 클릭해 <strong className="text-sky-300">맞교환(Swap)</strong>할 수도 있습니다.
              </p>
            </div>
          </div>

          {/* Balance Evaluation KPI Card */}
          <div className={`p-4 rounded-2xl border ${gradeInfo.bg} flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl`}>
            <div className="flex items-center gap-3">
              <span className={`text-base font-black ${gradeInfo.color}`}>
                {gradeInfo.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                팀 점수 차: <strong className="text-white">{pointDiff}</strong> 점
              </span>
            </div>

            {/* Total Points Scoreboard */}
            <div className="flex items-center gap-6 font-mono self-end md:self-center">
              <div className="text-center">
                <span className="text-[11px] font-bold text-sky-400 block font-sans">
                  블루팀 총점
                </span>
                <span className="text-2xl font-black text-sky-400 tabular-nums">
                  {blueTotalPoints}
                  <span className="text-xs font-normal text-slate-400 ml-1">점</span>
                </span>
              </div>
              <span className="text-lg font-bold text-slate-600">VS</span>
              <div className="text-center">
                <span className="text-[11px] font-bold text-rose-400 block font-sans">
                  레드팀 총점
                </span>
                <span className="text-2xl font-black text-rose-400 tabular-nums">
                  {redTotalPoints}
                  <span className="text-xs font-normal text-slate-400 ml-1">점</span>
                </span>
              </div>
            </div>
          </div>

          {/* Swap Instruction Prompt */}
          {selectedSwapSlot && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between animate-pulse">
              <span>
                <strong>{selectedSwapSlot.team === 'blue' ? '블루팀' : '레드팀'} {LANE_KOREAN[selectedSwapSlot.lane]}</strong> 선수가 선택되었습니다. 교환할 다른 선수를 클릭하세요.
              </span>
              <button
                onClick={() => setSelectedSwapSlot(null)}
                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]"
              >
                선택 취소
              </button>
            </div>
          )}

          {/* 5-Lane Matchup Cards Grid */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-2xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-3 bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
              <div className="col-span-5 text-sky-400">블루팀</div>
              <div className="col-span-2 text-slate-400">라인전 매치업</div>
              <div className="col-span-5 text-rose-400">레드팀</div>
            </div>

            {/* 5 Lanes Rows */}
            <div className="divide-y divide-slate-800/80">
              {LANES.map((lane) => {
                const blueSlot = activeBlueRoster?.[lane];
                const redSlot = activeRedRoster?.[lane];

                const bluePoints = blueSlot ? (TIER_CONFIG[blueSlot.player.tier]?.points ?? 4) : 0;
                const redPoints = redSlot ? (TIER_CONFIG[redSlot.player.tier]?.points ?? 4) : 0;
                const laneDiff = bluePoints - redPoints;

                const isBlueSelected =
                  selectedSwapSlot?.team === 'blue' && selectedSwapSlot?.lane === lane;
                const isRedSelected =
                  selectedSwapSlot?.team === 'red' && selectedSwapSlot?.lane === lane;

                return (
                  <div
                    key={lane}
                    className="grid grid-cols-12 gap-2 p-3.5 items-center hover:bg-slate-800/20 transition-colors"
                  >
                    {/* Blue Player Card */}
                    <div className="col-span-5">
                      {blueSlot && (
                        <div
                          onClick={() => handleSlotClick('blue', lane)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isBlueSelected
                              ? 'bg-sky-500/20 border-sky-400 ring-2 ring-sky-400'
                              : 'bg-sky-950/20 border-sky-500/30 hover:border-sky-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {blueSlot.player.name}
                              </span>
                              {getRoleBadge(blueSlot)}
                            </div>
                            <div className="text-[11px] font-mono mt-0.5 text-slate-400">
                              <span className={TIER_CONFIG[blueSlot.player.tier]?.color}>
                                {TIER_CONFIG[blueSlot.player.tier]?.label}
                              </span>{' '}
                              · {bluePoints}점
                            </div>
                          </div>

                          <span className="text-[11px] text-slate-500 hover:text-sky-300 font-mono">
                            맞교환
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Center Lane Indicator */}
                    <div className="col-span-2 text-center space-y-1">
                      <div className="text-xs font-bold text-slate-200">
                        {LANE_KOREAN[lane]}
                      </div>
                      <div
                        className={`text-[10px] font-mono font-bold ${
                          laneDiff > 0
                            ? 'text-sky-400'
                            : laneDiff < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {laneDiff > 0
                          ? `블루 +${laneDiff}점`
                          : laneDiff < 0
                          ? `레드 +${Math.abs(laneDiff)}점`
                          : '동등 (0점)'}
                      </div>
                    </div>

                    {/* Red Player Card */}
                    <div className="col-span-5">
                      {redSlot && (
                        <div
                          onClick={() => handleSlotClick('red', lane)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isRedSelected
                              ? 'bg-rose-500/20 border-rose-400 ring-2 ring-rose-400'
                              : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {redSlot.player.name}
                              </span>
                              {getRoleBadge(redSlot)}
                            </div>
                            <div className="text-[11px] font-mono mt-0.5 text-slate-400">
                              <span className={TIER_CONFIG[redSlot.player.tier]?.color}>
                                {TIER_CONFIG[redSlot.player.tier]?.label}
                              </span>{' '}
                              · {redPoints}점
                            </div>
                          </div>

                          <span className="text-[11px] text-slate-500 hover:text-rose-300 font-mono">
                            맞교환
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: 10-Player Roster Management */}
        <section className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                참가자 명단
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                여기서 티어나 주/부포지션을 직접 수정해도 즉시 반영됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearRoster}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/30 hover:border-rose-500/50 transition-colors whitespace-nowrap cursor-pointer"
              >
                전체 초기화
              </button>
              <button
                onClick={handleResetSample}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                샘플 복원
              </button>
            </div>
          </div>

          {/* 10 Players Table */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold font-mono">
                  <tr>
                    <th className="p-3 w-12 text-center">번호</th>
                    <th className="p-3 min-w-[140px]">닉네임</th>
                    <th className="p-3 min-w-[160px]">티어</th>
                    <th className="p-3 min-w-[130px]">주 포지션</th>
                    <th className="p-3 min-w-[130px]">부 포지션</th>
                    <th className="p-3 w-24 text-right">환산 점수</th>
                    <th className="p-3 w-12 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {players.map((player, index) => {
                    const tierInfo = TIER_CONFIG[player.tier];
                    return (
                      <tr key={player.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-center text-slate-500 font-mono">
                          {index + 1}
                        </td>

                        {/* Name Input */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={player.name}
                            onChange={(e) =>
                              handleUpdatePlayer(player.id, 'name', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                          />
                        </td>

                        {/* Tier Dropdown */}
                        <td className="p-3">
                          <select
                            value={player.tier}
                            onChange={(e) =>
                              handleUpdatePlayer(player.id, 'tier', e.target.value as TierRank)
                            }
                            className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold focus:outline-none focus:border-sky-500 ${tierInfo.color}`}
                          >
                            {Object.entries(TIER_CONFIG).map(([key, info]) => (
                              <option key={key} value={key} className="bg-slate-900 text-white">
                                {info.label} ({info.points}점)
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Main Position Dropdown */}
                        <td className="p-3">
                          <select
                            value={player.mainPos}
                            onChange={(e) =>
                              handleUpdatePlayer(player.id, 'mainPos', e.target.value as Position)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                          >
                            {POSITIONS.map((pos) => (
                              <option key={pos.key} value={pos.key} className="bg-slate-900">
                                {pos.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Sub Position Dropdown */}
                        <td className="p-3">
                          <select
                            value={player.subPos ?? 'ALL'}
                            onChange={(e) =>
                              handleUpdatePlayer(player.id, 'subPos', e.target.value as Position)
                            }
                            className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs focus:outline-none focus:border-sky-500 ${
                              player.subPos === 'NONE'
                                ? 'text-rose-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {SUB_POSITIONS.map((pos) => (
                              <option key={pos.key} value={pos.key} className="bg-slate-900 text-slate-200">
                                {pos.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Points badge */}
                        <td className="p-3 text-right font-mono font-bold text-white tabular-nums">
                          {tierInfo.points} 점
                        </td>

                        {/* Individual Delete/Clear Icon */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleResetSinglePlayer(index)}
                            title={`${index + 1}번 닉네임 초기화`}
                            aria-label={`${index + 1}번 닉네임 초기화`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors inline-flex items-center justify-center cursor-pointer"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* 10-Player Fast Paste Modal */}
      <FastPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onApply={(newPlayers) => {
          setPlayers(newPlayers);
          setCopyToast('10명의 주/부포지션이 반영되어 최적 밸런싱되었습니다.');
          setTimeout(() => setCopyToast(null), 2500);
        }}
      />

      {/* Matchup Image Export Modal */}
      <ImageExportModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        blueTeam={activeBlueRoster || null}
        redTeam={activeRedRoster || null}
        bluePoints={blueTotalPoints}
        redPoints={redTotalPoints}
        pointDiff={pointDiff}
        gradeLabel={gradeInfo.label}
      />

      {/* Tier Point Table Modal */}
      {isTierTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  포인트 환산 표
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  5대5 내전 시 양 팀의 밸런스를 측정하는 공인 티어 환산 점수표입니다.
                </p>
              </div>
              <button
                onClick={() => setIsTierTableOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold font-mono sticky top-0">
                  <tr>
                    <th className="p-3 w-40">티어 등급</th>
                    <th className="p-3 w-28 font-mono">환산 포인트</th>
                    <th className="p-3">전력 평가 및 밸런스 기준</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                  {Object.entries(TIER_CONFIG).map(([key, info]) => {
                    const descriptions: Record<string, string> = {
                      CHALLENGER: '최상위 천상계 전력, 압도적인 라인전과 독보적인 게임 캐리력',
                      GRANDMASTER: '프로/준프로급 체급, 정밀한 교전 능력과 날카로운 오더',
                      MASTER: '팀의 핵심 에이스 전력, 안정적인 한타 주도권',
                      DIAMOND_1_2: '마스터 승급권 전력, 탄탄한 피지컬과 맵 리딩',
                      DIAMOND_3_4: '상위권 탄탄한 기본기, 메인 딜러/이니시 역할 수행',
                      EMERALD_1_2: '다이아 진입권, 준수한 라인전과 합류 교전력',
                      EMERALD_3_4: '평균 이상의 챔피언 숙련도와 한타 포지셔닝',
                      PLATINUM: '중상위권 밸런스 지표, 1인분 역할을 확실히 해내는 전력',
                      GOLD: '내전 표준 밸런스 기준점, 모스트 챔피언 기용 시 강력한 변수 창출',
                      SILVER: '팀 서포팅 및 안정적 파밍 중심의 전력',
                      BRONZE: '언더독 플레이어, 예상 밖의 조커 픽 변수',
                      IRON: '내전 입문 및 기초 전력 (기본 1점 기준)',
                    };

                    return (
                      <tr key={key} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <span className={`inline-block font-bold ${info.color}`}>
                            {info.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-white tabular-nums">
                          {info.points} 점
                        </td>
                        <td className="p-3 text-slate-300 font-sans">
                          {descriptions[key] || '공식 밸런스 환산 기준'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                onClick={() => setIsTierTableOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-12 bg-[#07080d] py-5 text-xs text-slate-500 text-center">
        <span>내전 밸런스 조절기</span>
      </footer>
    </div>
  );
}
