import StatusBadge from "./StatusBadge";

type Credential = {
  issuer: string;
  credentialSubject: { name: string; degree: string; major: string; graduationDate: string; gpa?: number };
};

export default function DiplomaCard({
  credential,
  hash,
  status,
  blockNumber,
}: {
  credential: Credential;
  hash: string;
  status: string;
  blockNumber?: number;
}) {
  const subject = credential.credentialSubject;
  const [firstName, ...rest] = subject.name.split(" ");
  const lastName = rest.join(" ");
  return (
    <div className="diploma">
      <div className="d-corners">
        <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
      </div>
      <div className="d-head">— Diploma of the Establishment —</div>
      <div className="issuer">Issued under {credential.issuer.slice(0, 28)}…</div>
      <div className="holder">{firstName} <span className="swash">{lastName || ""}</span></div>
      <div className="confer">is hereby confer&apos;d the degree of</div>
      <div className="degree">{subject.degree} in {subject.major}</div>
      <hr className="rule" />
      <div className="meta">
        <div>Graduation<b>{subject.graduationDate}</b></div>
        {subject.gpa !== undefined && (
          <div>GPA<b>{subject.gpa.toFixed(2)}</b></div>
        )}
        <div>Hash<b className="mono">{hash.slice(0, 10)}…</b></div>
        {blockNumber !== undefined && (
          <div>Block<b>#{blockNumber}</b></div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.4rem" }}>
        <StatusBadge status={status} />
      </div>
      <div className="wax" aria-hidden>CV</div>
    </div>
  );
}
