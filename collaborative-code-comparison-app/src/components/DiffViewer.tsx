// DiffViewer - Displays comparison results with color-coded highlighting
// Shows matched content in green, differences in red, with character-level precision

import { useState } from 'react';
import { ComparisonResult, DiffTab } from '../types';

interface DiffViewerProps {
  result: ComparisonResult | null;
  userName: string;
  colleagueName: string;
}

export default function DiffViewer({
  result,
  userName,
  colleagueName,
}: DiffViewerProps) {
  const [activeTab, setActiveTab] = useState<DiffTab>('all');

  if (!result) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <div className="text-white/30 text-sm">
          📝 لسه مستنيين الحلول... اكتبوا حلولكم وهنقارنهم تلقائي
        </div>
      </div>
    );
  }

  if (result.totalLines === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <div className="text-white/30 text-sm">
          📝 اكتبوا الحلول وهنقارنهم تلقائي
        </div>
      </div>
    );
  }

  const tabs: { key: DiffTab; label: string; icon: string }[] = [
    { key: 'all', label: 'كل الفروق', icon: '📊' },
    { key: 'matched', label: 'المتطابق', icon: '✅' },
    { key: 'different', label: 'المختلف', icon: '❌' },
  ];

  const getFilteredLines = () => {
    switch (activeTab) {
      case 'matched':
        return result.diffLines.filter((d) => d.type === 'equal');
      case 'different':
        return result.diffLines.filter((d) => d.type !== 'equal');
      default:
        return result.diffLines;
    }
  };

  const filteredLines = getFilteredLines();

  // Color for percentage ring
  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return '#10b981'; // emerald
    if (pct >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const percentageColor = getPercentageColor(result.matchPercentage);

  return (
    <div className="glass rounded-2xl overflow-hidden fade-in">
      {/* Header with percentage ring */}
      <div className="p-4 md:p-5 border-b border-white/5">
        <div className="flex items-center gap-4">
          {/* Circular percentage indicator */}
          <div className="relative flex-shrink-0">
            <svg width="64" height="64" className="percentage-ring">
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke={percentageColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 27}
                strokeDashoffset={
                  2 * Math.PI * 27 - (result.matchPercentage / 100) * 2 * Math.PI * 27
                }
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-sm font-bold"
                style={{ color: percentageColor }}
              >
                {result.matchPercentage}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white/80 font-semibold text-sm mb-1">
              نتيجة المقارنة
            </h3>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-400">
                ✅ {result.matchedLines} متطابق
              </span>
              <span className="text-red-400">
                ❌ {result.differentLines} مختلف
              </span>
              <span className="text-white/30">
                📏 {result.totalLines} سطر
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="hidden md:flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded bg-emerald-500/30" />
              <span className="text-white/40">متطابق</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded bg-red-500/30" />
              <span className="text-white/40">مختلف</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded bg-blue-500/30" />
              <span className="text-white/40">مضافة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'text-white bg-white/5 tab-active'
                : 'text-white/30 hover:text-white/50'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.key === 'matched' && (
              <span className="mr-1 text-emerald-400">
                ({result.matchedLines})
              </span>
            )}
            {tab.key === 'different' && (
              <span className="mr-1 text-red-400">
                ({result.differentLines})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Diff content */}
      <div className="max-h-80 overflow-y-auto p-3 md:p-4">
        {filteredLines.length === 0 ? (
          <div className="text-center text-white/20 text-sm py-8">
            {activeTab === 'matched'
              ? 'مفيش حاجات متطابقة 😕'
              : activeTab === 'different'
                ? 'كل حاجة متطابقة! 🎉'
                : 'مفيش بيانات'}
          </div>
        ) : (
          <div className="code-area text-xs leading-relaxed space-y-0.5">
            {filteredLines.map((line, idx) => (
              <DiffLineRenderer
                key={idx}
                line={line}
                lineNum={idx + 1}
                userName={userName}
                colleagueName={colleagueName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual diff line renderer with character-level highlighting
 */
function DiffLineRenderer({
  line,
  lineNum,
  userName,
  colleagueName,
}: {
  line: any;
  lineNum: number;
  userName: string;
  colleagueName: string;
}) {
  if (line.type === 'equal') {
    return (
      <div className="flex items-start gap-2 px-2 py-0.5 rounded hover:bg-white/3 transition-colors">
        <span className="line-number">{lineNum}</span>
        <span className="text-emerald-400/80">{line.line1}</span>
      </div>
    );
  }

  if (line.type === 'removed') {
    return (
      <div className="flex items-start gap-2 px-2 py-0.5 bg-red-500/8 rounded border-r-2 border-red-500/40">
        <span className="line-number">{lineNum}</span>
        <div className="flex-1">
          <span className="text-red-400/50 text-xs ml-2">
            ← {userName}
          </span>
          <span className="text-red-400">{line.line1}</span>
        </div>
      </div>
    );
  }

  if (line.type === 'added') {
    return (
      <div className="flex items-start gap-2 px-2 py-0.5 bg-blue-500/8 rounded border-r-2 border-blue-500/40">
        <span className="line-number">{lineNum}</span>
        <div className="flex-1">
          <span className="text-blue-400/50 text-xs ml-2">
            ← {colleagueName}
          </span>
          <span className="text-blue-400">{line.line2}</span>
        </div>
      </div>
    );
  }

  if (line.type === 'modified' && line.charDiffs) {
    return (
      <div className="px-2 py-1 rounded border border-amber-500/20 bg-amber-500/5 space-y-1">
        {/* Your version */}
        <div className="flex items-start gap-2">
          <span className="line-number">{lineNum}</span>
          <div className="flex-1">
            <span className="text-red-400/50 text-xs ml-2">
              ← {userName}
            </span>
            <span>
              {line.charDiffs.map(
                (cd: any, i: number) =>
                  cd.type !== 'added' && (
                    <span
                      key={i}
                      className={
                        cd.type === 'removed'
                          ? 'bg-red-500/20 text-red-400 line-through'
                          : 'text-white/30'
                      }
                    >
                      {cd.value}
                    </span>
                  )
              )}
            </span>
          </div>
        </div>
        {/* Colleague's version */}
        <div className="flex items-start gap-2">
          <span className="line-number" />
          <div className="flex-1">
            <span className="text-blue-400/50 text-xs ml-2">
              ← {colleagueName}
            </span>
            <span>
              {line.charDiffs.map(
                (cd: any, i: number) =>
                  cd.type !== 'removed' && (
                    <span
                      key={i}
                      className={
                        cd.type === 'added'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-white/30'
                      }
                    >
                      {cd.value}
                    </span>
                  )
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
