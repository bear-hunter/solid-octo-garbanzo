import "./style.css";
import Link from "next/link";
import { Cormorant_Garamond, EB_Garamond, IM_Fell_English_SC, IM_Fell_DW_Pica } from "next/font/google";
import RoleNav from "./components/RoleNav";
import ChainStatusPill from "./components/ChainStatusPill";
import { DensityToggle } from "./components/DensityToggle";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});
const imFellSc = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-smallcaps",
  display: "swap",
});
const imFellItalic = IM_Fell_DW_Pica({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-script",
  display: "swap",
});

export const metadata = {
  title: "CredVerify - Academic Credentials, Verifiable by Anyone",
  description: "Blockchain-anchored, self-sovereign academic credential issuance and verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = `${cormorant.variable} ${ebGaramond.variable} ${imFellSc.variable} ${imFellItalic.variable}`;
  return (
    <html lang="en" className={fontVars}>
      <body>
        <div className="paper-grain" aria-hidden />
        <header className="masthead">
          <div className="vol">Vol. <em>I</em> &middot; No. <em>VII</em> &middot; Bound in Sepolia</div>
          <Link href="/" className="brand">
            <div className="brand-line">- A REGISTER OF -</div>
            <div className="brand-name">Cred<span className="amp">&amp;</span>Verify</div>
            <div className="brand-sub">academic credentials, made portable &amp; provable</div>
            <div className="ornament"><span className="rule" /><span className="dot" /><span className="rule" /></div>
          </Link>
          <div className="folio">
            <ChainStatusPill />
            <RoleNav />
            <DensityToggle />
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
