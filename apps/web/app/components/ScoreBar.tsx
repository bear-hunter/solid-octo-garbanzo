type Breakdown = Record<string, number>;

const MAX: Breakdown = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const ORDER: Array<keyof typeof MAX> = ["signature", "issuer", "onChain", "revocation", "contentIntegrity", "schema"];
const ROMAN = ["i.", "ii.", "iii.", "iv.", "v.", "vi."];
const LABELS: Record<string, { label: string; sub: string }> = {
  signature: { label: "Signature of the issuer", sub: "ES256 over canonicalised payload" },
  issuer: { label: "Issuer DID resolves on-chain", sub: "institutionRegistry.isAuthorized(did) ↦ active" },
  onChain: { label: "IPFS address matches anchor", sub: "credentialRegistry.cid ≡ presented" },
  revocation: { label: "Not revoked", sub: "revoked flag on CredentialRecord" },
  contentIntegrity: { label: "Document hash matches anchor", sub: "sha256(canonical(vc)) ≡ anchored" },
  schema: { label: "Schema valid", sub: "W3C VC v1 · zod schema parse" },
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
