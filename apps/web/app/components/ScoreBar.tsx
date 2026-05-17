type Breakdown = Record<string, number>;

const MAX: Breakdown = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const LABELS: Record<string, string> = {
  schema: "Schema",
  issuer: "Issuer",
  signature: "Signature",
  contentIntegrity: "Content hash",
  onChain: "On-chain CID",
  revocation: "Revocation",
};

export default function ScoreBar({ score, breakdown }: { score: number; breakdown?: Breakdown }) {
  return (
    <div>
      <div className="score-head">
        <b>{score}</b>
        <span className="muted">/ 100 trust score</span>
      </div>
      {breakdown &&
        Object.entries(MAX).map(([key, max]) => {
          const value = breakdown[key] ?? 0;
          const full = value >= max;
          return (
            <div className="score-row" key={key}>
              <span>{LABELS[key]}</span>
              <span className="score-track">
                <span className={`score-fill ${full ? "" : "partial"}`} style={{ width: `${(value / max) * 100}%` }} />
              </span>
              <span className="mono">
                {value}/{max}
              </span>
            </div>
          );
        })}
    </div>
  );
}
