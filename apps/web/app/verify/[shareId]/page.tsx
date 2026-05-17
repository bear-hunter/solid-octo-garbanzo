import VerifyPage from "../VerifyPage";

export default async function Page({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  return <VerifyPage shareId={shareId} />;
}
