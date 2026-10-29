import React, { useState } from 'react';
import { LobbyPlayer, Position, TierRank } from '../types';

interface FastPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (players: LobbyPlayer[]) => void;
}

const SLASH_PLACEHOLDER = `김민수 / 마스터 / 미드 / 불가능
이영희 / 다이아1 / 정글 / 서폿
박철수 / 다이아4 / 탑 / 미드
최지훈 / 에메랄드2 / 원딜 / 미드
정수진 / 골드 / 서폿 / 상관없음
강동현 / 그랜드마스터 / 탑 / 정글
윤하은 / 에메랄드3 / 정글 / 불가능
한준호 / 플래티넘 / 미드 / 원딜
송태양 / 골드 / 원딜 / 서폿
배유진 / 실버 / 서폿 / 상관없음`;

export const FastPasteModal: React.FC<FastPasteModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const parseLines = (rawText: string): LobbyPlayer[] => {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: LobbyPlayer[] = [];

    const tierMap: Record<string, TierRank> = {
      챌: 'CHALLENGER',
      챌린저: 'CHALLENGER',
      challenger: 'CHALLENGER',
      그마: 'GRANDMASTER',
      그랜드마스터: 'GRANDMASTER',
      gm: 'GRANDMASTER',
      grandmaster: 'GRANDMASTER',
      마: 'MASTER',
      마스터: 'MASTER',
      master: 'MASTER',
      다1: 'DIAMOND_1_2',
      다2: 'DIAMOND_1_2',
      다이아1: 'DIAMOND_1_2',
      다이아2: 'DIAMOND_1_2',
      d1: 'DIAMOND_1_2',
      d2: 'DIAMOND_1_2',
      다3: 'DIAMOND_3_4',
      다4: 'DIAMOND_3_4',
      다이아3: 'DIAMOND_3_4',
      다이아4: 'DIAMOND_3_4',
      d3: 'DIAMOND_3_4',
      d4: 'DIAMOND_3_4',
      다: 'DIAMOND_3_4',
      다이아: 'DIAMOND_3_4',
      diamond: 'DIAMOND_3_4',
      에1: 'EMERALD_1_2',
      에2: 'EMERALD_1_2',
      에메랄드1: 'EMERALD_1_2',
      에메랄드2: 'EMERALD_1_2',
      e1: 'EMERALD_1_2',
      e2: 'EMERALD_1_2',
      에3: 'EMERALD_3_4',
      에4: 'EMERALD_3_4',
      에메랄드3: 'EMERALD_3_4',
      에메랄드4: 'EMERALD_3_4',
      e3: 'EMERALD_3_4',
      e4: 'EMERALD_3_4',
      에: 'EMERALD_3_4',
      에메: 'EMERALD_3_4',
      에메랄드: 'EMERALD_3_4',
      emerald: 'EMERALD_3_4',
      플: 'PLATINUM',
      플레: 'PLATINUM',
      플래티넘: 'PLATINUM',
      platinum: 'PLATINUM',
      골: 'GOLD',
      골드: 'GOLD',
      gold: 'GOLD',
      실: 'SILVER',
      실버: 'SILVER',
      silver: 'SILVER',
      브: 'BRONZE',
      브론즈: 'BRONZE',
      bronze: 'BRONZE',
      아: 'IRON',
      아이언: 'IRON',
      iron: 'IRON',
    };

    const posMap: Record<string, Position> = {
      탑: 'TOP',
      탑솔: 'TOP',
      top: 'TOP',
      정글: 'JUG',
      정: 'JUG',
      jg: 'JUG',
      jug: 'JUG',
      jungle: 'JUG',
      미드: 'MID',
      미: 'MID',
      mid: 'MID',
      middle: 'MID',
      원딜: 'ADC',
      원: 'ADC',
      봇: 'ADC',
      바텀: 'ADC',
      bot: 'ADC',
      bottom: 'ADC',
      adc: 'ADC',
      서폿: 'SUP',
      폿: 'SUP',
      서포터: 'SUP',
      sup: 'SUP',
      support: 'SUP',
      올: 'ALL',
      올라: 'ALL',
      올라운더: 'ALL',
      상관없음: 'ALL',
      all: 'ALL',
      아무거나: 'ALL',
      아무데나: 'ALL',
      불가능: 'NONE',
      불가: 'NONE',
      없음: 'NONE',
      none: 'NONE',
      x: 'NONE',
      '-': 'NONE',
    };

    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];

      // Parse by slash '/' separator: 이름 / 티어 / 주포 / 부포
      const tokens = line
        .split('/')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const name = tokens[0] || `플레이어 ${i + 1}`;
      const rawTier = tokens[1]?.toLowerCase().replace(/\s+/g, '') || '';
      const rawMain = tokens[2]?.toLowerCase().replace(/\s+/g, '') || '';
      const rawSub = tokens[3]?.toLowerCase().replace(/\s+/g, '') || '';

      const detectedTier = tierMap[rawTier] || 'GOLD';
      const mainPos = posMap[rawMain] || 'ALL';
      const subPos = posMap[rawSub] || 'ALL';

      parsed.push({
        id: `p-${Date.now()}-${i}`,
        name,
        tier: detectedTier,
        mainPos,
        subPos,
      });
    }

    // Fill up to 10 if fewer rows provided
    const fallbackPositions: Position[] = [
      'TOP', 'JUG', 'MID', 'ADC', 'SUP',
      'TOP', 'JUG', 'MID', 'ADC', 'SUP',
    ];
    while (parsed.length < 10) {
      const idx = parsed.length;
      parsed.push({
        id: `p-${Date.now()}-${idx}`,
        name: `플레이어 ${idx + 1}`,
        tier: 'GOLD',
        mainPos: fallbackPositions[idx],
        subPos: 'ALL',
      });
    }

    return parsed;
  };

  const handleApply = () => {
    const textToUse = inputText.trim() || SLASH_PLACEHOLDER;
    const players = parseLines(textToUse);
    onApply(players);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              10명 일괄 붙여넣기
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              디스코드나 카톡에 조사받은 슬래시(/) 형식 명단을 그대로 붙여넣어 주세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Text Area with Slash Format Preview Placeholder */}
        <div>
          <textarea
            rows={11}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={SLASH_PLACEHOLDER}
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 leading-relaxed"
          />
        </div>

        {/* Bottom Action Bar with Single-Line Explanation and '밸런싱' Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-3">
          <span className="text-[11px] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
            * 슬래시(/) 형식: 닉네임 / 티어 / 주포 / 부포 (예: 철수 / 골드 / 미드 / 탑)
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors whitespace-nowrap"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-sky-500/20 whitespace-nowrap"
            >
              밸런싱
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
