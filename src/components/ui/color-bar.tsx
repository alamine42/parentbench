import { scoreToColorClasses } from "@/lib/scores";

type ColorBarProps = {
  score: number;
  showValue?: boolean;
  height?: "sm" | "md";
};

const heightClasses = {
  sm: "h-1.5",
  md: "h-2.5",
};

export function ColorBar({
  score,
  showValue = false,
  height = "md",
}: ColorBarProps) {
  const colors = scoreToColorClasses(score);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 overflow-hidden rounded-full bg-muted-bg ${heightClasses[height]}`}
      >
        <div
          className={`${heightClasses[height]} rounded-full transition-all ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {showValue && (
        <span className={`text-xs font-medium tabular-nums ${colors.text}`}>
          {score}
        </span>
      )}
    </div>
  );
}
