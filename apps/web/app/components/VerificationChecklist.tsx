type CheckStatus = "verified" | "warning" | "failed" | "unavailable" | "not_applicable";
type CheckKey = "signature" | "issuer" | "onChain" | "revocation" | "contentIntegrity" | "schema";
type Check = { key: CheckKey; status: CheckStatus; message: string };
type Breakdown = Record<string, number>;

const MAX: Record<CheckKey, number> = { schema: 15, issuer: 20, signature: 20, contentIntegrity: 20, onChain: 15, revocation: 10 };
const ORDER: CheckKey[] = ["signature", "issuer", "onChain", "revocation", "contentIntegrity", "schema"];
const ROMAN = ["i.", "ii.", "iii.", "iv.", "v.", "vi."];
const LABELS: Record<CheckKey, { label: string; verified: string; failed: string }> = {
  signature: { label: "Signature of the issuer", verified: "Signature matches the canonical credential payload.", failed: "Signature or credential schema verification failed." },
  issuer: { label: "Issuer recognized", verified: "Issuer DID resolves and is active.", failed: "Issuer DID is missing, inactive, or does not match the credential." },
  onChain: { label: "Chain anchor", verified: "Credential anchor matches the registry record.", failed: "Credential anchor or CID does not match the registry." },
  revocation: { label: "Revocation status", verified: "Credential is not revoked.", failed: "Credential has been revoked." },
  contentIntegrity: { label: "Content integrity", verified: "Credential content matches the anchored hash.", failed: "Credential content hash does not match the registry." },
  schema: { label: "Schema and validity", verified: "Credential is well-formed and currently acceptable.", failed: "Credential schema or validity window failed." },
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  verified: "Verified",
  warning: "Warning",
  failed: "Failed",
  unavailable: "Unavailable",
  not_applicable: "Not applicable",
};

const STATUS_MARK: Record<CheckStatus, string> = {
  verified: "✓",
  warning: "⚠",
  failed: "✕",
  unavailable: "?",
  not_applicable: "—",
};

function fallbackChecks(status: string, breakdown?: Breakdown): Check[] {
  if (status === "unavailable") {
    return ORDER.map((key) => ({ key, status: "unavailable", message: "This check could not be completed because credential content or registry evidence was unavailable." }));
  }
  return ORDER.map((key) => {
    const verified = (breakdown?.[key] ?? 0) >= MAX[key];
    return { key, status: verified ? "verified" : "failed", message: verified ? LABELS[key].verified : LABELS[key].failed };
  });
}

function verdictLabel(status: string, checks: Check[]) {
  if (status === "revoked") return "Revoked";
  if (status === "unavailable") return "Unverifiable";
  if (status === "valid") return "Valid · In Good Standing";
  if (checks.some((check) => check.status === "failed")) return "Invalid";
  return "Review Required";
}

export default function VerificationChecklist({ status, checks, breakdown }: { status: string; checks?: Check[]; breakdown?: Breakdown }) {
  const resolved = checks?.length ? checks : fallbackChecks(status, breakdown);
  const counts = resolved.reduce<Record<CheckStatus, number>>((acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  }, { verified: 0, warning: 0, failed: 0, unavailable: 0, not_applicable: 0 });

  return (
    <div>
      <div className={`verification-verdict ${status === "valid" ? "" : "partial"}`}>— {verdictLabel(status, resolved)} —</div>
      <p className="verification-summary">
        {counts.verified} verified · {counts.warning} warnings · {counts.failed} failed · {counts.unavailable} unavailable
      </p>
      {resolved.map((check, idx) => {
        const meta = LABELS[check.key];
        return (
          <div className={`check-row ${check.status}`} key={check.key}>
            <span className="roman">{ROMAN[idx]}</span>
            <span className="check-mark" aria-hidden="true">{STATUS_MARK[check.status]}</span>
            <span className="lbl">
              {meta.label}
              <em>{check.message}</em>
            </span>
            <span className={`check-status ${check.status}`}>{STATUS_LABEL[check.status]}</span>
          </div>
        );
      })}
    </div>
  );
}
