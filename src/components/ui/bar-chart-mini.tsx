import type { SafetyCategory } from "@/types/model";
import { CATEGORY_META } from "@/lib/constants";
import { scoreToColorClasses } from "@/lib/scores";

type BarChartMiniProps = {
  categories: Record<SafetyCategory, number>;
};

const abbreviations: Record<SafetyCategory, string> = {
  honesty: "H",
  fairness: "F",
  refusal_to_harm: "R",
  manipulation_resistance: "M",
  privacy_respect: "P",
  straight_talk: "S",
};

export function BarChartMini({ categories }: BarChartMiniProps) {
  const entries = Object.entries(categories) as [SafetyCategory, number][];

  return (
    <div className="flex flex-col gap-1">
      {entries.map(([category, score]) => {
        const colors = scoreToColorClasses(score);
        return (
          <div key={category} className="flex items-center gap-1.5">
            <span
              className="w-3 text-[10px] font-medium text-muted"
              title={CATEGORY_META[category].label}
            >
              {abbreviations[category]}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-bg">
              <div
                className={`h-1.5 rounded-full ${colors.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className={`w-5 text-right text-[10px] font-medium ${colors.text}`}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
