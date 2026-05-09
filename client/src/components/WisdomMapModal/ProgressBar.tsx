// ProgressBar.tsx - Segmented progress bar showing per-seed, per-mode completion
import { FC } from 'react';
import './css/ProgressBar.css';

export interface SeedSliceStatus {
  seedId: string | number;
  storyDone: boolean;
  wisdomDone: boolean;
  prismDone: boolean;
  questDone: boolean;
}

interface ProgressBarTranslations {
  progress?: string;
  completed?: string;
  seedsGathered?: string;
  constellationComplete?: string;
}

interface ProgressBarProps {
  // Legacy props — still used for the label
  gatheredCount: number;
  totalSeeds: number;
  progressPercentage: number;
  isCompleted: boolean;
  translations?: ProgressBarTranslations;
  // New segmented data (optional for backwards compat)
  seedSlices?: SeedSliceStatus[];
}

const ProgressBar: FC<ProgressBarProps> = ({
  gatheredCount,
  totalSeeds,
  progressPercentage,
  isCompleted,
  translations = {
    progress: 'Progress',
    completed: 'Completed',
    seedsGathered: 'seeds gathered',
    constellationComplete: 'Constellation Complete!'
  },
  seedSlices
}) => {
  const {
    progress = 'Progress',
    completed = 'Completed',
    seedsGathered = 'seeds gathered',
    constellationComplete = 'Constellation Complete!'
  } = translations;

  // If we have segmented data, render bloom gradient bar
  if (seedSlices && seedSlices.length > 0) {
    const modeColors = [
      'var(--mode-story)',
      'var(--mode-wisdom)',
      'var(--mode-prism)',
      'var(--mode-quest)',
    ];
    const ghostColors = [
      'color-mix(in srgb, var(--mode-story) 10%, transparent)',
      'color-mix(in srgb, var(--mode-wisdom) 10%, transparent)',
      'color-mix(in srgb, var(--mode-prism) 10%, transparent)',
      'color-mix(in srgb, var(--mode-quest) 10%, transparent)',
    ];

    // Seed-grouped gradient with gaps between seeds
    const gapPct = 0.4;
    const usable = 100 - (seedSlices.length - 1) * gapPct;
    const seedW = usable / seedSlices.length;
    const sliceW = seedW / 4;
    const stops: string[] = [];
    const bloomCenters: number[] = [];

    seedSlices.forEach((slice, i) => {
      const base = i * (seedW + gapPct);
      const doneFlags = [slice.storyDone, slice.wisdomDone, slice.prismDone, slice.questDone];
      const allDone = doneFlags.every(Boolean);

      if (allDone) {
        // Bloom: smooth flowing gradient for fully complete seeds
        stops.push(
          `${modeColors[0]} ${base.toFixed(2)}%`,
          `${modeColors[1]} ${(base + sliceW * 1.3).toFixed(2)}%`,
          `${modeColors[2]} ${(base + sliceW * 2.7).toFixed(2)}%`,
          `${modeColors[3]} ${(base + seedW).toFixed(2)}%`
        );
        bloomCenters.push(base + seedW / 2);
      } else {
        // Striped: hard stops with ghost colors for empty
        doneFlags.forEach((done, j) => {
          const color = done ? modeColors[j] : ghostColors[j];
          const start = base + j * sliceW;
          const end = base + (j + 1) * sliceW;
          stops.push(`${color} ${start.toFixed(2)}%`, `${color} ${end.toFixed(2)}%`);
        });
      }

      // Transparent gap between seeds (except last)
      if (i < seedSlices.length - 1) {
        const gs = base + seedW;
        stops.push(`transparent ${gs.toFixed(2)}%`, `transparent ${(gs + gapPct).toFixed(2)}%`);
      }
    });

    const gradient = `linear-gradient(90deg, ${stops.join(', ')})`;

    return (
      <div className={`progress-section ${isCompleted ? 'completed' : ''}`}>
        <div
          className="segmented-progress-bar"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={isCompleted ? completed : progress}
        >
          <div className="segmented-fill" style={{ background: gradient }} />
          {bloomCenters.map((pos, i) => (
            <div key={i} className="segmented-bloom-glow" style={{ left: `${pos}%` }} />
          ))}
        </div>
      </div>
    );
  }

  // Fallback: legacy continuous bar
  return (
    <div className={`progress-section ${isCompleted ? 'completed' : ''}`}>
      <div className="progress-bar">
        <div
          className="progress"
          style={{
            width: `${progressPercentage}%`,
            willChange: 'width, background-position'
          }}
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={isCompleted ? completed : progress}
        >
        </div>
      </div>
      <div className="progress-label">
        <span className="progress-count">{gatheredCount} of {totalSeeds} {seedsGathered}</span>
        {isCompleted && <span className="completion-badge">{constellationComplete}</span>}
      </div>
    </div>
  );
};

export default ProgressBar;
