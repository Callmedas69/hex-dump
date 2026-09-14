import { DeadDropWorkspace } from "@/components/DeadDropWorkspace";

export const metadata = { title: "Open a private message | HexOnion", robots: { index: false, follow: false } };

export default async function ReadDeadDropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeadDropWorkspace key={id} retrievalId={id} />;
}
