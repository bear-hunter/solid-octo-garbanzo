type Breakdown = Record<string, number>;

const MAX: Breakdown = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const ORDER: Array<keyof typeof MAX> = ["signature", "issuer", "onChain", "revocation", "contentIntegrity", "schema"];
const ROMAN = ["i.", "ii.", "iii.", "iv.", "v.", "vi."];
const LABELS: Record<string, { label: string; sub: string }> = {
  signature: {
    label: "Signed by the issuer",
    sub: "Only the issuer's private key could have produced this signature — we verified it with their public key.",
  },
  issuer: {
    label: "Issuer is authorised on-chain",
    sub: "The signing institution's DID is registered active in the on-chain institution registry.",
  },
  onChain: {
    label: "Storage address matches anchor",
    sub: "The IPFS address we received is the same one the issuer recorded on the blockchain.",
  },
  revocation: {
    label: "Not revoked",
    sub: "The on-chain registry has no revocation entry for this credential.",
  },
  contentIntegrity: {
    label: "Document is unaltered",
    sub: "Re-hashing the document yields exactly the fingerprint anchored on-chain — no character changed since issuance.",
  },
  schema: {
    label: "Well-formed credential",
    sub: "Conforms to the W3C Verifiable Credential schema.",
  },
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
