import type { RiskLevel } from "@flash-sale/shared";

const riskBadge: Record<RiskLevel, string> = {
  high: "bg-red-950 text-red-400 border-red-900",
  medium: "bg-amber-950 text-amber-400 border-amber-900",
  low: "bg-emerald-950 text-emerald-400 border-emerald-900",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${riskBadge[risk]}`}
    >
      {risk}
    </span>
  );
}
