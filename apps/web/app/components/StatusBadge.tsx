const LABELS: Record<string, string> = {
  valid: "Verified",
  revoked: "Revoked",
  tampered: "Tampered",
  unknownIssuer: "Unknown Issuer",
  unavailable: "Unavailable",
  invalid: "Invalid",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{LABELS[status] ?? status}</span>;
}
