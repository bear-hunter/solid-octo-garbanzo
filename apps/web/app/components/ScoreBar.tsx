type Breakdown = Record<string, number>;

const MAX: Breakdown = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const ORDER: Array<keyof typeof MAX> = ["signature", "issuer", "onChain", "revocation", "contentIntegrity", "schema"];
const ROMAN = ["i.", "ii.", "iii.", "iv.", "v.", "vi."];
const LABELS: Record<string, { label: string; sub: string }> = {
  signature: { label: "Signature of the issuer", sub: "ed25519 over canonicalised payload" },
  issuer: { label: "Issuer DID resolves on-chain", sub: "institutionRegistry.lookup() ↦ active" },
  onChain: { label: "Hash anchored at block", sub: "credentialRegistry.anchorOf(jwt)" },
  revocation: { label: "Not revoked", sub: "nullifier(jwt) ∉ revocationSet" },
  contentIntegrity: { label: "Content matches anchored hash", sub: "sha256(canonical(vc)) ≡ anchored" },
  schema: { label: "Schema & validity window", sub: "nbf ≤ now ≤ exp · W3C VC v2" },
};

export default function ScoreBar({ score, breakdown }: { score: number; breakdown?: Breakdown }) {
  const grade = score >= 95 ? "Granted · In Good Standing" : score >= 70 ? "Granted · With Reservations" : "Withheld";
  return (
    <div>
      <div className="score-head">
        <b>{score}</b>
        <span className="of">/ 100</span>
      </div>
      <div className={`score-grade${score < 95 ? " partial" : ""}`}>— {grade} —</div>
      {breakdown &&
        ORDER.map((key, idx) => {
          const max = MAX[key];
          const value = breakdown[key] ?? 0;
          const full = value >= max;
          const meta = LABELS[key];
          return (
            <div className="score-row" key={key}>
              <span className="roman">{ROMAN[idx]}</span>
              <span className="lbl">
                {meta.label}
                <em>{meta.sub}</em>
              </span>
              <span className="score-track">
                <span
                  className={`score-fill ${full ? "" : "partial"}`}
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <span className="val">{value}/{max}</span>
            </div>
          );
        })}
    </div>
  );
}
