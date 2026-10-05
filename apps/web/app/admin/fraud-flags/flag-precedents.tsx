import { FRAUD_FLAG_STATUSES, type FraudFlag } from "@flash-sale/shared";
import { PATTERN_FIELDS, parsePattern } from "./parse-pattern";
import { RiskBadge } from "./risk-badge";
import { FRAUD_FLAG_STATUS_LABELS } from "./status-labels";

const cell = "px-3 py-2";
const headCell = `${cell} text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide`;

function PatternCells({ pattern }: { pattern: string }) {
  const values = parsePattern(pattern);
  if (!values) {
    return (
      <td colSpan={PATTERN_FIELDS.length} className={`${cell} font-mono text-xs text-zinc-400`}>
        {pattern}
      </td>
    );
  }
  return PATTERN_FIELDS.map(({ key }) => (
    <td key={key} className={`${cell} font-mono text-zinc-300`}>
      {values[key]}
    </td>
  ));
}

// The order's own pattern next to the confirmed cases the model saw, in prompt order,
// so a moderator can judge the evidence behind the verdict.
export function FlagPrecedents({ flag }: { flag: FraudFlag }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className={headCell}>
            <span className="sr-only">Case</span>
          </th>
          {PATTERN_FIELDS.map(({ key, label }) => (
            <th key={key} className={headCell}>
              {label}
            </th>
          ))}
          <th className={headCell}>Risk</th>
          <th className={headCell}>Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/60">
        <tr className="bg-zinc-800/40">
          <th scope="row" className={`${cell} text-left font-medium text-zinc-200`}>
            This order
          </th>
          <PatternCells pattern={flag.pattern} />
          <td className={cell}>
            <RiskBadge risk={flag.risk} />
          </td>
          <td className={`${cell} text-zinc-600`}>—</td>
        </tr>
        {flag.citations.map((citation) => (
          <tr key={citation.position}>
            <th scope="row" className={`${cell} text-left font-normal text-zinc-400`}>
              Precedent {citation.position}
            </th>
            <PatternCells pattern={citation.pattern} />
            <td className={cell}>
              <RiskBadge risk={citation.risk} />
            </td>
            <td className={`${cell} text-zinc-400`}>
              {citation.reason}
              {citation.status !== FRAUD_FLAG_STATUSES.CONFIRMED && (
                <span className="ml-2 text-xs text-amber-400">
                  now {FRAUD_FLAG_STATUS_LABELS[citation.status].toLowerCase()}
                </span>
              )}
              <span
                className="ml-2 text-xs font-mono text-zinc-600"
                title="Embedding distance to this order — lower is closer"
              >
                d={citation.distance.toFixed(3)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
