import Link from "next/link";

const ROLES = [
  { href: "/issuer", step: "01", title: "Institution", body: "Register an issuer DID, then sign and anchor academic credentials on-chain." },
  { href: "/holder", step: "02", title: "Holder", body: "Hold your credential as a portable diploma, copy its JWT/CID, and share a verifier link." },
  { href: "/verify", step: "03", title: "Verifier", body: "Check any credential against its on-chain proof and get an explainable trust score." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Academic credentials, verifiable by anyone.</h1>
        <p className="intro" style={{ padding: 0 }}>
          CredVerify issues W3C-style verifiable credentials signed by institutional DIDs, stores them on IPFS,
          and anchors their hashes on an Ethereum-compatible registry — so a degree can be verified without
          ever contacting the issuing university.
        </p>
      </section>
      <section className="grid cols-3 role-cards">
        {ROLES.map((role) => (
          <Link key={role.href} href={role.href}>
            <div className="card role-card stack">
              <div className="step">{role.step}</div>
              <h2 style={{ margin: 0 }}>{role.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {role.body}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
