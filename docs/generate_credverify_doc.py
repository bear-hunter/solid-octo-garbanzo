"""Generates docs/CredVerify.docx — a self-contained reference covering what
CredVerify is, how each page works, and how the blockchain anchors trust.

Run from the repo root:
    python docs/generate_credverify_doc.py
"""

from pathlib import Path
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


INK = RGBColor(0x1A, 0x12, 0x08)
BURGUNDY = RGBColor(0x6B, 0x14, 0x10)
INK_SOFT = RGBColor(0x3A, 0x2A, 0x18)
MOSS = RGBColor(0x4A, 0x5D, 0x2E)


def shade(cell, hex_color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def style_run(run, *, size: int = 11, bold: bool = False, italic: bool = False, color: RGBColor = INK, font: str = "Calibri") -> None:
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color


def add_heading(doc: Document, text: str, level: int = 1) -> None:
    sizes = {1: 22, 2: 16, 3: 13}
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    style_run(run, size=sizes.get(level, 12), bold=True, color=INK if level == 1 else BURGUNDY, font="Cambria")


def add_para(doc: Document, text: str, *, italic: bool = False, bold: bool = False, color: RGBColor = INK_SOFT, size: int = 11) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.3
    run = p.add_run(text)
    style_run(run, size=size, italic=italic, bold=bold, color=color)


def add_bullet(doc: Document, text: str, *, level: int = 0) -> None:
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Cm(0.7 + 0.7 * level)
    p.paragraph_format.space_after = Pt(3)
    run = p.runs[0] if p.runs else p.add_run("")
    run.text = text
    style_run(run, size=11, color=INK_SOFT)


def add_mono(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(text)
    style_run(run, size=10, color=INK, font="Consolas")


def add_quote(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.8)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(text)
    style_run(run, size=11, italic=True, color=INK)


def add_table(doc: Document, headers: list[str], rows: list[list[str]]) -> None:
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Light Grid Accent 1"
    table.autofit = True

    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        run = p.add_run(h)
        style_run(run, size=10, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), font="Cambria")
        shade(cell, "1A1208")

    for r_idx, row in enumerate(rows, start=1):
        for c_idx, val in enumerate(row):
            cell = table.rows[r_idx].cells[c_idx]
            cell.text = ""
            p = cell.paragraphs[0]
            run = p.add_run(val)
            style_run(run, size=10, color=INK_SOFT)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)


def page_break(doc: Document) -> None:
    doc.add_page_break()


def build() -> Path:
    doc = Document()

    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

    # --- Title page -----------------------------------------------------------
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(60)
    run = title.add_run("CredVerify")
    style_run(run, size=36, bold=True, color=INK, font="Cambria")

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(40)
    run = subtitle.add_run("A Blockchain-Enabled Decentralised Framework\nfor the Immutable Verification of Academic Credentials")
    style_run(run, size=14, italic=True, color=BURGUNDY, font="Cambria")

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.paragraph_format.space_after = Pt(8)
    run = meta.add_run("Project documentation")
    style_run(run, size=12, color=INK_SOFT)

    meta2 = doc.add_paragraph()
    meta2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta2.add_run("Features · Usage · How the blockchain works")
    style_run(run, size=11, italic=True, color=INK_SOFT)

    page_break(doc)

    # --- 1. What is this ------------------------------------------------------
    add_heading(doc, "1. What is CredVerify?", 1)
    add_para(
        doc,
        "CredVerify is a working prototype of the system described in the thesis "
        "“A Blockchain-Enabled Decentralised Framework for the Immutable Verification "
        "of Academic Credentials Using Self-Sovereign Identity and Verifiable Data "
        "Models.” It is a web application in which three actors — an institution, a "
        "credential holder, and a verifier — interact with a real Ethereum-compatible "
        "blockchain and an IPFS-style content store to issue, hold, and verify "
        "tamper-evident academic credentials without anyone having to contact the "
        "issuing university."
    )
    add_para(
        doc,
        "The blockchain stores only the cryptographic fingerprint of each credential "
        "and a small amount of metadata. The credential itself — the W3C Verifiable "
        "Credential document — lives off-chain on IPFS. Verification is done "
        "mathematically: the verifier rehashes the document and asks the blockchain "
        "whether the hash, the issuer, and the revocation flag still agree. If they "
        "do, the credential is trusted; if any one diverges, the verifier knows "
        "exactly which check failed."
    )

    add_heading(doc, "Project structure at a glance", 2)
    add_table(
        doc,
        ["Layer", "Technology", "Purpose"],
        [
            ["Smart contracts", "Solidity 0.8.28, Hardhat", "Authority registry and credential anchors on an EVM chain"],
            ["Credential engine", "TypeScript, jose, @noble/hashes", "DID generation, ES256 signing, SHA-256 hashing, the trust-score verifier"],
            ["Off-chain storage", "IPFS (Kubo) or local-disk fallback", "Holds the signed credential JSON addressed by content hash"],
            ["Backend services", "Next.js 15 API routes + dependency-injected service layer", "Orchestrates issue / verify / revoke / share"],
            ["Frontend", "Next.js 15 + React 19, Cormorant Garamond + Inter", "Four pages — Issuer, Holder, Verifier, Ledger — each scoped to one role"],
        ],
    )

    page_break(doc)

    # --- 2. The four pages ----------------------------------------------------
    add_heading(doc, "2. The four pages and how to use them", 1)
    add_para(
        doc,
        "The app is divided by role. The top navigation gives access to each: Issuer, "
        "Holder, Verifier, and Ledger. A small status pill at the top of every page "
        "shows the current chain mode and block number, plus whether the off-chain "
        "storage is reachable, so the demonstrator can confirm at a glance that the "
        "system is bound to a live chain."
    )

    # Issuer
    add_heading(doc, "2.1 The Institution’s Dashboard (/issuer)", 2)
    add_para(
        doc,
        "Used by a university to register itself as an authorised issuer and to "
        "produce credentials. Four metric tiles summarise activity: anchors written, "
        "in good standing, revoked, and tribunals served (verifier checks)."
    )
    add_heading(doc, "Typical flow", 3)
    add_bullet(doc, "Click ‘Load Presentation Records’ once to seed an example institution (Northbridge State University) and an example student (Ada Lovelace). The button is idempotent — clicking again does nothing if the records already exist.")
    add_bullet(doc, "Issuer Identity card: type an institution name and click ‘Register Institution DID’. The app generates a fresh keypair, derives a DID, and registers it on-chain in the InstitutionRegistry contract. From that point on, the credential contract will accept anchors signed by this issuer.")
    add_bullet(doc, "Student Holder card: type a student name and click ‘Create Student DID’. The student gets a keypair and DID; the institution will issue against this identity.")
    add_bullet(doc, "Issue a Credential card: fill in studentId, degree, major, graduation date, GPA. Click ‘Sign & Anchor Credential’. The credential is built, signed as an ES256 JWT, written to IPFS, and its SHA-256 hash is registered in the CredentialRegistry contract. The success banner shows a real transaction hash.")
    add_bullet(doc, "Register of Issuances table lists every credential the institution has issued, with its on-chain block number, its current status, and a Revoke button. Revoking sends a second on-chain transaction.")
    add_bullet(doc, "Audit Trail at the bottom lists the last twelve events in time order.")

    # Holder
    add_heading(doc, "2.2 The Holder’s Wallet (/holder)", 2)
    add_para(
        doc,
        "Used by a student. The student selects a credential they have been issued and "
        "sees three things side by side: the credential rendered as a diploma card, "
        "and a panel of portable proofs."
    )
    add_heading(doc, "What appears", 3)
    add_bullet(doc, "Diploma card: rendered with a wax seal, the issuer DID, the degree and major in serif, the holder’s name, the GPA, and the block number where the credential was anchored on-chain.")
    add_bullet(doc, "Portable Proof card with the IPFS CID, the anchored hash, and a truncated view of the signed JWT, each with a copy-to-clipboard button.")
    add_bullet(doc, "‘Mint Verifier Link’ button: creates a short share link of the form /verify/<shareId>. Anyone who opens the link can verify the credential without logging in.")

    # Verifier
    add_heading(doc, "2.3 The Verifier’s Tribunal (/verify)", 2)
    add_para(
        doc,
        "Public — no login. Anyone given a share link, an ID, a CID, or a signed JWT can "
        "submit the credential to the tribunal and receive an explainable six-part "
        "trust score."
    )
    add_heading(doc, "How to use", 3)
    add_bullet(doc, "Submission to the Tribunal: pick a credential on record from the dropdown, or open a share link. The credential’s contents appear in editable form fields.")
    add_bullet(doc, "‘Verify as Recorded’ submits the credential exactly as the issuer anchored it. Expected verdict: Verified, 100/100.")
    add_bullet(doc, "Edit any field — name, degree, major, graduation, GPA, studentId — and the field is flagged ‘altered’ in burgundy. The submit button updates to ‘Submit Altered Copy (N fields changed)’. Clicking it submits the modified document. The verifier rehashes the submission and compares it with the anchored hash. Because any change yields a different SHA-256, the verdict becomes Tampered.")
    add_bullet(doc, "‘Reset Fields’ rolls the form back to the anchored values.")
    add_bullet(doc, "‘Load Sample Records’ seeds Ada Lovelace’s presentation credential if not present.")
    add_bullet(doc, "Advanced — Submit Raw JSON discloses a textarea for submitting a raw {id|cid|jwt|shareId} payload (used by share-link routes).")
    add_para(
        doc,
        "The right-hand panel shows the verdict: a status badge (Verified, Tampered, "
        "Revoked, Unknown Issuer, Unavailable, or Invalid), a one-sentence narrative "
        "that adapts to the verdict, a score out of 100, a six-row breakdown with "
        "plain-English explanations of each predicate, and a list of predicates that "
        "disagreed when the verdict is not Verified. The audit timeline below records "
        "every verification attempt against that credential."
    )

    # Ledger
    add_heading(doc, "2.4 The Ledger (/ledger)", 2)
    add_para(
        doc,
        "A direct view of the on-chain state. This is the page to show when an "
        "evaluator asks ‘where is the blockchain in all this?’."
    )
    add_heading(doc, "What appears", 3)
    add_bullet(doc, "Network card: chain mode (local Hardhat by default, or sepolia), current block number, off-chain storage mode, and whether each is live or in fallback.")
    add_bullet(doc, "Deployed Contracts card: the on-chain addresses of InstitutionRegistry and CredentialRegistry as written when the contracts were deployed (deployments.localhost.json).")
    add_bullet(doc, "Transactions table: every issue and revoke this app has produced, most recent first, with the action, block number, transaction hash, gas used, the holder/degree the receipt pertains to, and the anchored credential hash. The table auto-refreshes every ten seconds so newly produced receipts appear without a reload.")

    page_break(doc)

    # --- 3. How the blockchain works ----------------------------------------
    add_heading(doc, "3. How the blockchain works in this app", 1)
    add_para(
        doc,
        "The blockchain holds two pieces of state: a registry of authorised issuers, "
        "and a registry of credentials. The credential JSON itself never lives "
        "on-chain — only its hash and a few small fields do. Putting documents on-chain "
        "would be expensive and would leak private data. Storing only the fingerprint "
        "is enough to prove the document has not been changed."
    )

    add_heading(doc, "3.1 The two smart contracts", 2)

    add_heading(doc, "InstitutionRegistry.sol", 3)
    add_para(doc, "Holds the set of issuer DIDs that are allowed to anchor credentials.")
    add_bullet(doc, "registerInstitution(did, name) — only-owner; called when a university registers in the app. Stores (did, name, active, registeredAt) keyed by keccak256(did).")
    add_bullet(doc, "isAuthorized(did) — view; returns whether the institution is registered and currently active.")
    add_bullet(doc, "setActive(did, active) — only-owner; toggles an issuer on or off.")
    add_bullet(doc, "Emits InstitutionRegistered and InstitutionStatusChanged events.")

    add_heading(doc, "CredentialRegistry.sol", 3)
    add_para(doc, "Holds the per-credential record. Its constructor takes the InstitutionRegistry address so it can gate every anchor.")
    add_bullet(doc, "registerCredential(credentialHash, cid, issuerDid, subjectDidHash) — first calls institutions.isAuthorized(issuerDid). Reverts if the issuer is not registered, and reverts on duplicate credentialHash. Otherwise writes (credentialHash, cid, issuerDid, subjectDidHash, issuedAt = block.timestamp, revoked = false, revocationReason = ''). Emits CredentialIssued.")
    add_bullet(doc, "revokeCredential(credentialHash, reason) — flips the credential’s revoked flag and stores the reason. Emits CredentialRevoked.")
    add_bullet(doc, "getCredential(credentialHash) — view; returns the full record. Verification reads this.")

    add_heading(doc, "3.2 What goes on-chain vs off-chain", 2)
    add_table(
        doc,
        ["Item", "On-chain", "Off-chain (IPFS)"],
        [
            ["Issuer DID + name + active flag", "Yes — in InstitutionRegistry", "—"],
            ["Credential SHA-256 hash", "Yes — keyed in CredentialRegistry", "—"],
            ["IPFS CID of the credential JSON", "Yes — stored alongside the hash", "—"],
            ["Issuer DID per credential", "Yes — checked against InstitutionRegistry", "—"],
            ["Hash of the subject DID", "Yes — keeps subject identifiable on-chain without revealing it", "—"],
            ["Revoked flag + reason", "Yes — on the credential record", "—"],
            ["Signed credential document (JWT)", "No", "Yes — stored by the IPFS adapter"],
            ["Holder name, degree, GPA, etc.", "No", "Yes — inside the signed JWT"],
            ["Issuer public key (JWK)", "No — only referenced via DID", "Yes — kept in the app’s local repository"],
        ],
    )

    add_heading(doc, "3.3 Issuance flow, step by step", 2)
    add_bullet(doc, "The app calls generateIdentity() to produce an ECDSA P-256 keypair when an institution or student is created.")
    add_bullet(doc, "createAcademicCredential(...) builds a W3C-shaped Verifiable Credential JSON: @context, type, issuer, issuanceDate, credentialSubject.")
    add_bullet(doc, "signCredential(...) signs the credential as a JWT using the issuer’s private key with the ES256 algorithm. The JWT is the portable signed form holders can carry.")
    add_bullet(doc, "hashHex(credential) produces a SHA-256 digest of the canonicalised JSON. This is the fingerprint that goes on-chain.")
    add_bullet(doc, "The storage adapter writes the credential JSON either to a real IPFS node via Kubo’s HTTP API or to a local disk store, and returns a CID.")
    add_bullet(doc, "The registry adapter calls CredentialRegistry.registerCredential(hash, cid, issuerDid, subjectDidHash). On a real chain this is a transaction — the success path returns a tx hash, block number, and gas used, which the UI surfaces on the Issuer page and the Ledger page.")
    add_bullet(doc, "The app records the resulting StoredCredential row locally (id, jwt, credential, cid, hash, issuer, subject, chain receipt) so the dashboard and tables can render quickly without re-querying the chain for every read.")

    add_heading(doc, "3.4 Verification flow, step by step", 2)
    add_bullet(doc, "The verifier provides one of: a credential id, a share link, a CID, a JWT, or an entire altered credential object (the tampering path).")
    add_bullet(doc, "The service looks up the local row, then fetches the on-chain record by calling CredentialRegistry.getCredential(hash). It also fetches the credential JSON from IPFS by its CID.")
    add_bullet(doc, "The trust-score engine (verifyCredential) runs six independent checks and awards points: schema (15), issuer (20), signature (20), content integrity (20), on-chain CID (15), revocation (10). They sum to 100.")
    add_bullet(doc, "If everything agrees, the verdict is Verified, score 100. If one or more diverge, the verdict reflects the most damning failure: Tampered (hash or CID mismatch), Revoked (on-chain flag set), Unknown Issuer (issuer not authorised), Invalid (schema or signature broken), or Unavailable (document cannot be fetched).")

    add_heading(doc, "3.5 Adapter pattern — why the chain layer can be swapped", 2)
    add_para(
        doc,
        "The same app can run against a local Hardhat chain (default), against the "
        "Sepolia public testnet, or against an in-memory simulation, with no app-level "
        "code changes. Two environment variables decide which:"
    )
    add_bullet(doc, "CHAIN_MODE = local | sepolia | memory")
    add_bullet(doc, "IPFS_MODE = kubo | local")
    add_para(
        doc,
        "On startup the app health-checks the selected backend. If, for example, the "
        "Hardhat node is not running, the chain selector falls back to the in-memory "
        "registry and the status pill turns red, so a defence never hard-fails. The "
        "ethers-based adapter wraps the signer in NonceManager so transactions queued "
        "back-to-back receive sequential nonces even under bursts."
    )

    page_break(doc)

    # --- 4. Trust score predicates ------------------------------------------
    add_heading(doc, "4. The six predicates of the trust score", 1)
    add_para(
        doc,
        "The verifier returns a six-part breakdown that explains the verdict in "
        "non-technical terms while remaining defensible to a technical reviewer. Each "
        "predicate gets full marks or zero — partial scores per predicate are not used."
    )
    add_table(
        doc,
        ["#", "Predicate", "What it proves", "Points", "How it can fail"],
        [
            ["I",  "Signed by the issuer",          "Only the issuer’s private key could have produced this signature; we verified it with their public key.",                     "20", "A submitted JWT does not verify against the issuer’s registered public key. (The current engine treats this as Invalid rather than Tampered.)"],
            ["II", "Issuer is authorised on-chain", "The signing institution’s DID is registered and active in the on-chain InstitutionRegistry.",                                 "20", "Submitted credential’s issuer field is not in the registry, or has been deactivated."],
            ["III","Storage address matches anchor","The IPFS address we received is the same one the issuer recorded on the blockchain.",                                          "15", "Submitter presents a CID different from the one stored in CredentialRegistry."],
            ["IV", "Not revoked",                   "The on-chain registry has no revocation entry for this credential.",                                                            "10", "The issuer has called revokeCredential — the on-chain revoked flag is true."],
            ["V",  "Document is unaltered",         "Re-hashing the document yields exactly the fingerprint anchored on-chain — no character has changed since issuance.",          "20", "Submitter has altered any field; the SHA-256 of the canonicalised JSON differs from the on-chain hash."],
            ["VI", "Well-formed credential",        "Conforms to the W3C Verifiable Credential schema (v1).",                                                                       "15", "Required fields are missing or have the wrong type; the schema parse fails."],
        ],
    )

    page_break(doc)

    # --- 5. Local setup and demo walkthrough --------------------------------
    add_heading(doc, "5. Running the app locally", 1)
    add_para(
        doc,
        "The intended local environment uses Node 22, pnpm, Hardhat for the chain, "
        "and optional Docker for Kubo IPFS. Without Docker the app falls back to a "
        "local-disk store and still functions end-to-end."
    )

    add_heading(doc, "5.1 First-time setup", 2)
    add_mono(doc, "pnpm install\npnpm chain         # terminal 1 — starts the local Hardhat node\npnpm run deploy    # terminal 2 — deploys both contracts, writes deployments.localhost.json\npnpm ipfs          # terminal 3 — optional; falls back to local storage if Docker is off\npnpm dev           # terminal 4 — Next.js dev server at http://localhost:3000")

    add_heading(doc, "5.2 Useful commands", 2)
    add_table(
        doc,
        ["Command", "What it does"],
        [
            ["pnpm test",            "Vitest unit tests for the credential engine and adapters"],
            ["pnpm test:contracts",  "Hardhat tests for both Solidity contracts"],
            ["pnpm test:e2e",        "Service-layer integration test (issue → verify → revoke → re-verify)"],
            ["pnpm typecheck",       "Strict TypeScript check across the workspace"],
            ["pnpm build",           "Production Next.js build"],
            ["pnpm evaluate",        "Verification-metrics harness (accuracy + latency)"],
        ],
    )

    add_heading(doc, "5.3 Demo walkthrough", 2)
    add_bullet(doc, "Open http://localhost:3000. Confirm the chain-status pill reads ‘local #N · ipfs:local’.")
    add_bullet(doc, "Go to Issuer. Click ‘Load Presentation Records’. Confirm the metrics tiles update, the Register of Issuances table gains a row, and the message line reads ‘Credential issued and anchored (local) · tx 0x…’.")
    add_bullet(doc, "Go to Holder. Confirm the diploma card renders with a real block number. Click ‘Mint Verifier Link’ — the link is copied to the clipboard.")
    add_bullet(doc, "Go to Verifier. Click ‘Verify as Recorded’. Confirm verdict: Verified, score 100/100, all six predicate bars full, narrative reads ‘Authentic …’.")
    add_bullet(doc, "Edit the Degree field to something else; the field turns burgundy. Click ‘Submit Altered Copy’. Confirm verdict: Tampered, score 60/100, narrative says the document does not match what was anchored, and the predicate ‘Document is unaltered’ shows 0/20.")
    add_bullet(doc, "Go to Issuer and click Revoke on the row. A second on-chain transaction is sent.")
    add_bullet(doc, "Go to Verifier and verify again. Verdict: Revoked, narrative reflects the on-chain flag.")
    add_bullet(doc, "Go to Ledger. Confirm a Network card showing the contract addresses, and a Transactions table listing the issue and revoke receipts with their tx hashes, block numbers, and gas used.")

    page_break(doc)

    # --- 6. Glossary --------------------------------------------------------
    add_heading(doc, "6. Glossary", 1)
    add_table(
        doc,
        ["Term", "Definition"],
        [
            ["DID (Decentralised Identifier)",    "A self-issued identifier of the form did:method:identifier. In CredVerify the method is example and the identifier is derived from a SHA-256 of the issuer’s public JWK."],
            ["Verifiable Credential (VC)",         "A W3C JSON document that an issuer can sign and a third party can later verify. CredVerify embeds the VC inside a JWT for transport."],
            ["JWT (JSON Web Token)",               "A signed payload using a JSON header, payload, and signature. CredVerify uses the ES256 algorithm — ECDSA on the P-256 curve."],
            ["IPFS (InterPlanetary File System)",  "A peer-to-peer content-addressed storage network. Files are addressed by a content identifier (CID) derived from their bytes, not by a server name."],
            ["CID (Content Identifier)",           "The IPFS address of a piece of content. Two identical files always hash to the same CID — content addressing makes tampering self-evident."],
            ["Smart contract",                     "Code deployed to a blockchain that runs deterministically when invoked. CredVerify uses two: InstitutionRegistry and CredentialRegistry, both Solidity 0.8.28."],
            ["Hardhat",                            "A local Ethereum development node. CredVerify uses it for the default ‘local’ chain mode."],
            ["Trust score",                        "The 0–100 number the verifier returns. It is the sum of points awarded by six independent checks; the status word (Verified, Tampered, Revoked, …) is determined by which checks failed."],
            ["Nonce",                              "A per-account transaction counter. CredVerify wraps the signer in NonceManager so back-to-back transactions get sequential nonces even when the chain’s pending pool would otherwise race."],
        ],
    )

    # --- Footer-ish closing --------------------------------------------------
    add_heading(doc, "Repository", 2)
    add_para(doc, "https://github.com/bear-hunter/solid-octo-garbanzo")

    out = Path(__file__).resolve().parent / "CredVerify.docx"
    doc.save(out)
    return out


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
