import "./style.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><nav><strong>CredTrust</strong><a href="/issue">Institution</a><a href="/holder">Student Wallet</a><a href="/verify">Verifier</a></nav>{children}</body></html>;
}
