import { ClubChatScreen } from "@/components/clubs/ClubChatScreen";

export default async function ClubChatPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  return <ClubChatScreen clubId={clubId} />;
}
