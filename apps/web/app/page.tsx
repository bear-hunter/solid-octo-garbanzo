import Link from "next/link";

const ROLES = [
  {
    href: "/issuer",
    step: "— Estate the First —",
    glyph: "℘",
    title: "Institution",
    body: "Register an issuer DID, mint your seal, then sign and anchor academic credentials upon the chain. Each issuance is sealed, dated, and indelibly published.",
    cta: "ENTER THE CHANCERY →",
  },
  {
    href: "/holder",
    step: "— Estate the Second —",
    glyph: "⚜",
    title: "Holder",
    body: "Hold your credential as a portable diploma. Copy the JWT or CID, mint a share link, present it to any party who would inspect the proof.",
    cta: "ENTER THE LIBRARY →",
  },
  {
    href: "/verify",
    step: "— Estate the Third —",
    glyph: "☞",
    title: "Verifier",
    body: "Inspect any credential against its on-chain anchor and receive an explainable six-part trust score, with the failing predicate named in plain language.",
    cta: "ENTER THE TRIBUNAL →",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="roman-anchor">I.</span>
        <div className="rise d1">
          <h1>
            A diploma <em>that proves<br/>itself</em>, <span className="swash">without</span> the registrar.
          </h1>
          <p className="lede">
            <span className="dropcap">C</span>redVerify issues W3C-style verifiable credentials signed by an institution&apos;s
            decentralised identifier, deposits the document on IPFS, and anchors its hash on an
            Ethereum-compatible registry — so a degree may be authenticated by anyone, anywhere,
            without ever petitioning the issuing university.
          </p>
          <div className="footnote">
            <span>§ Self-sovereign</span><span className="sep" />
            <span>§ On-chain anchored</span><span className="sep" />
            <span>§ Six-part trust</span>
          </div>
        </div>
        <div className="seal-wrap rise d2" aria-hidden>
          <div className="seal">
            <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="seal-gold" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#f1d28a"/>
                  <stop offset="60%" stopColor="#b8893a"/>
                  <stop offset="100%" stopColor="#7a5a1f"/>
                </radialGradient>
              </defs>
              <g className="ring-outer">
                <circle cx="200" cy="200" r="185" fill="none" stroke="#1a1208" strokeWidth="0.5"/>
                <circle cx="200" cy="200" r="170" fill="none" stroke="#1a1208" strokeWidth="0.5"/>
                <path id="seal-circle" d="M 200,200 m -178,0 a 178,178 0 1,1 356,0 a 178,178 0 1,1 -356,0" fill="none"/>
                <text fontFamily="var(--smallcaps), serif" fontSize="13" fill="#6b1410" letterSpacing="6">
                  <textPath href="#seal-circle" startOffset="0">
                    · VERITAS PER CATENAM · VERITAS PER CATENAM · VERITAS PER CATENAM ·
                  </textPath>
                </text>
              </g>
              <g className="ring-inner">
                <circle cx="200" cy="200" r="135" fill="none" stroke="#b8893a" strokeWidth="1"/>
                <circle cx="200" cy="200" r="120" fill="none" stroke="#1a1208" strokeWidth="0.4"/>
                <g stroke="#6b1410" strokeWidth="0.5" fill="#4a5d2e" opacity="0.85">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <path key={i} d="M 200 60 q -8 -10 -18 -8 q 6 -2 18 8 z" transform={`rotate(${i * 20} 200 200)`} />
                  ))}
                </g>
              </g>
              <circle cx="200" cy="200" r="92" fill="url(#seal-gold)" stroke="#1a1208" strokeWidth="1.2"/>
              <circle cx="200" cy="200" r="86" fill="none" stroke="#1a1208" strokeWidth="0.4" opacity="0.5"/>
              <text x="200" y="220" fontFamily="var(--display), serif" fontSize="110" fontStyle="italic" textAnchor="middle" fill="#1a1208" fontWeight="500">CV</text>
              <text x="200" y="252" fontFamily="var(--smallcaps), serif" fontSize="11" letterSpacing="6" textAnchor="middle" fill="#6b1410">MMXXVI</text>
              <path d="M 110 312 L 200 280 L 290 312 L 270 360 L 200 332 L 130 360 Z" fill="#6b1410" stroke="#4a0d09" strokeWidth="0.5"/>
              <text x="200" y="332" fontFamily="var(--smallcaps), serif" fontSize="13" letterSpacing="6" textAnchor="middle" fill="#f1e7cf">SIGILLUM</text>
            </svg>
          </div>
        </div>
      </section>

      <section className="role-grid role-cards rise d3" aria-label="Three roles">
        {ROLES.map((role) => (
          <Link key={role.href} href={role.href}>
            <div className="role-card">
              <div className="step">{role.step}</div>
              <div className="role-glyph">{role.glyph}</div>
              <h2>The <em>{role.title}</em></h2>
              <p>{role.body}</p>
              <span className="read">{role.cta}</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
