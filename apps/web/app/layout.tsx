import "./style.css";
import Link from "next/link";
import RoleNav from "./components/RoleNav";
import ChainStatusPill from "./components/ChainStatusPill";

export const metadata = {
  title: "CredVerify — Academic Credential Verification",
  description: "Blockchain-anchored, self-sovereign academic credential issuance and verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-mark">CV</span>
            CredVerify
          </Link>
          <ChainStatusPill />
          <RoleNav />
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
