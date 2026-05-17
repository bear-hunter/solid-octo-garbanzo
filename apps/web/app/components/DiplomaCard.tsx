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
  return (
    <div className="diploma">
      <div className="seal">CV</div>
      <div className="issuer">Issued under {credential.issuer.slice(0, 22)}…</div>
      <div className="degree">{subject.degree}</div>
      <div className="muted" style={{ marginBottom: "0.6rem" }}>
        in {subject.major}
      </div>
      <div className="holder">Conferred upon {subject.name}</div>
      <hr className="rule" />
      <div className="meta">
        <div>
          <span>Graduation</span>
          {subject.graduationDate}
        </div>
        {subject.gpa !== undefined && (
          <div>
            <span>GPA</span>
            {subject.gpa.toFixed(2)}
          </div>
        )}
        <div>
          <span>Credential hash</span>
          <span className="mono">{hash.slice(0, 18)}…</span>
        </div>
        {blockNumber !== undefined && (
          <div>
            <span>Anchored block</span>#{blockNumber}
          </div>
        )}
      </div>
      <div style={{ marginTop: "1rem" }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}
