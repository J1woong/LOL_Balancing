import React, { useEffect, useRef, useState } from 'react';
import { TeamAssignment } from '../types';
import { TIER_CONFIG } from '../data/tierConfig';

type Lane = 'TOP' | 'JUG' | 'MID' | 'ADC' | 'SUP';
const LANES: Lane[] = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];

const LANE_KOREAN: Record<Lane, string> = {
  TOP: '탑',
  JUG: '정글',
  MID: '미드',
  ADC: '원딜',
  SUP: '서폿',
};

const TIER_CANVAS_COLORS: Record<string, string> = {
  CHALLENGER: '#fbbf24',
  GRANDMASTER: '#f87171',
  MASTER: '#c084fc',
  DIAMOND_1_2: '#38bdf8',
  DIAMOND_3_4: '#60a5fa',
  EMERALD_1_2: '#34d399',
  EMERALD_3_4: '#10b981',
  PLATINUM: '#2dd4bf',
  GOLD: '#facc15',
  SILVER: '#94a3b8',
  BRONZE: '#d97706',
  IRON: '#a8a29e',
};

interface ImageExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueTeam: Record<Lane, TeamAssignment> | null;
  redTeam: Record<Lane, TeamAssignment> | null;
  bluePoints: number;
  redPoints: number;
  pointDiff: number;
  gradeLabel: string;
}

export const ImageExportModal: React.FC<ImageExportModalProps> = ({
  isOpen,
  onClose,
  blueTeam,
  redTeam,
  bluePoints,
  redPoints,
  pointDiff,
  gradeLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !blueTeam || !redTeam) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2x Retina resolution: canvas width 900 x 660, scaled for crystal clarity
    const width = 960;
    const height = 680;
    const scale = 2;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0c1017');
    bgGradient.addColorStop(1, '#06080d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle outer border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // Top Header Bar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.fillText('내전 밸런스 조절기', 36, 52);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
      now.getDate()
    ).padStart(2, '0')} 최적 5v5 대진표`;
    ctx.fillText(dateStr, 36, 75);

    // Grade and point difference badge
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(width - 240, 36, 204, 38, 8);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${gradeLabel} (차이: ${pointDiff}점)`, width - 138, 60);
    ctx.textAlign = 'left';

    // Header divider line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, 96);
    ctx.lineTo(width - 36, 96);
    ctx.stroke();

    // Scoreboard Card
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(36, 110, width - 72, 60, 10);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // Blue Team Score
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.fillText('블루팀 총점', 56, 145);
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${bluePoints}점`, 150, 146);

    // Center VS
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', width / 2, 146);
    ctx.textAlign = 'left';

    // Red Team Score
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('레드팀 총점', width - 150, 145);
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${redPoints}점`, width - 56, 146);
    ctx.textAlign = 'left';

    // 5 Lanes Table Header
    const rowStartY = 190;
    const rowHeight = 78;

    LANES.forEach((lane, idx) => {
      const y = rowStartY + idx * (rowHeight + 10);
      const blueSlot = blueTeam[lane];
      const redSlot = redTeam[lane];

      const blueRaw = blueSlot ? (TIER_CONFIG[blueSlot.player.tier]?.points ?? 4) : 0;
      const bluePts = blueSlot?.effectivePoints ?? blueRaw;
      const blueDeduct = blueSlot?.deduction ?? Math.max(0, Math.round((blueRaw - bluePts) * 10) / 10);

      const redRaw = redSlot ? (TIER_CONFIG[redSlot.player.tier]?.points ?? 4) : 0;
      const redPts = redSlot?.effectivePoints ?? redRaw;
      const redDeduct = redSlot?.deduction ?? Math.max(0, Math.round((redRaw - redPts) * 10) / 10);

      const laneDiff = Math.round((bluePts - redPts) * 10) / 10;

      // Row background
      ctx.fillStyle = idx % 2 === 0 ? '#0f172a80' : '#11182740';
      ctx.beginPath();
      ctx.roundRect(36, y, width - 72, rowHeight, 10);
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();

      // Center Lane Badge
      const centerCenterX = width / 2;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(centerCenterX - 45, y + 14, 90, 50, 8);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(LANE_KOREAN[lane], centerCenterX, y + 36);

      // Lane point diff indicator
      ctx.font = 'bold 11px monospace';
      if (laneDiff > 0) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`+${laneDiff}점`, centerCenterX, y + 53);
      } else if (laneDiff < 0) {
        ctx.fillStyle = '#f43f5e';
        ctx.fillText(`+${Math.abs(laneDiff)}점`, centerCenterX, y + 53);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('동등', centerCenterX, y + 53);
      }
      ctx.textAlign = 'left';

      // Blue Player (Left)
      if (blueSlot) {
        const bp = blueSlot.player;
        const tierInfo = TIER_CONFIG[bp.tier];

        // Nickname
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
        ctx.fillText(bp.name, 56, y + 34);

        // Role Badge if Sub or Off-role
        if (bp.mainPos !== lane && bp.mainPos !== 'ALL') {
          const isSub = bp.subPos === lane || bp.subPos === 'ALL';
          const isNone = bp.subPos === 'NONE';
          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
          ctx.fillStyle = isSub ? '#38bdf8' : isNone ? '#f43f5e' : '#fb7185';
          const badgeText = isSub ? '[부포]' : isNone ? '[불가능]' : '[라인꼬임]';
          const nameWidth = ctx.measureText(bp.name).width;
          ctx.fillText(badgeText, 56 + nameWidth + 10, y + 34);
        }

        // Tier and Points
        ctx.fillStyle = TIER_CANVAS_COLORS[bp.tier] || '#ffffff';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
        ctx.fillText(tierInfo?.label || bp.tier, 56, y + 56);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        const tierWidth = ctx.measureText(tierInfo?.label || bp.tier).width;
        let ptsText = ` · ${bluePts}점`;
        if (blueDeduct > 0) {
          ptsText += ` (-${blueDeduct}점)`;
        }
        ctx.fillText(ptsText, 56 + tierWidth, y + 56);
      }

      // Red Player (Right)
      if (redSlot) {
        const rp = redSlot.player;
        const tierInfo = TIER_CONFIG[rp.tier];

        ctx.textAlign = 'right';

        // Nickname
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
        ctx.fillText(rp.name, width - 56, y + 34);

        // Role Badge if Sub or Off-role
        if (rp.mainPos !== lane && rp.mainPos !== 'ALL') {
          const isSub = rp.subPos === lane || rp.subPos === 'ALL';
          const isNone = rp.subPos === 'NONE';
          ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
          ctx.fillStyle = isSub ? '#38bdf8' : isNone ? '#f43f5e' : '#fb7185';
          const badgeText = isSub ? '[부포]' : isNone ? '[불가능]' : '[라인꼬임]';
          const nameWidth = ctx.measureText(rp.name).width;
          ctx.fillText(badgeText, width - 56 - nameWidth - 10, y + 34);
        }

        // Tier and Points
        let ptsText = ` · ${redPts}점`;
        if (redDeduct > 0) {
          ptsText += ` (-${redDeduct}점)`;
        }
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(ptsText, width - 56, y + 56);

        const ptsWidth = ctx.measureText(ptsText).width;
        ctx.fillStyle = TIER_CANVAS_COLORS[rp.tier] || '#ffffff';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
        ctx.fillText(tierInfo?.label || rp.tier, width - 56 - ptsWidth, y + 56);

        ctx.textAlign = 'left';
      }
    });

    // Footer Watermark
    ctx.fillStyle = '#475569';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif';
    ctx.fillText('내전 밸런스 조절기', 36, height - 20);

    // Export to data URL for preview
    const dataUrl = canvas.toDataURL('image/png');
    setImageUrl(dataUrl);
  }, [isOpen, blueTeam, redTeam, bluePoints, redPoints, pointDiff, gradeLabel]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `내전_대진표_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    showToast('대진표 이미지가 다운로드되었습니다.');
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          showToast('이미지 생성에 실패했습니다.');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          showToast('이미지가 클립보드에 복사되었습니다! (Ctrl+V로 붙여넣기)');
        } catch (err) {
          // If browser clipboard image write is not permitted
          handleDownload();
          showToast('클립보드 권한으로 인해 파일로 다운로드되었습니다.');
        }
      }, 'image/png');
    } catch (e) {
      handleDownload();
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              대진표 이미지 추출
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              디스코드나 카카오톡 단체방에 바로 공유할 수 있는 고해상도 대진표 이미지입니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Hidden Canvas for generation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Image Preview Container */}
        <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2 flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="대진표 이미지 미리보기"
              className="max-h-[58vh] w-auto rounded-lg shadow-lg border border-slate-800 object-contain"
            />
          ) : (
            <div className="py-20 text-slate-500 text-xs">이미지 생성 중...</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800 gap-3">
          <span className="text-xs text-slate-400">
            {toast ? (
              <strong className="text-sky-400">{toast}</strong>
            ) : (
              '클립보드에 복사하면 카톡/디스코드에 바로 붙여넣을 수 있습니다.'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyImage}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-sky-500/20 cursor-pointer whitespace-nowrap"
            >
              이미지 복사
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              PNG 다운로드
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
