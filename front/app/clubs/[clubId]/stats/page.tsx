import { ClubStatisticsScreen } from "@/components/clubs/ClubStatisticsScreen";

export default async function ClubStatisticsPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  return <ClubStatisticsScreen clubId={clubId} />;
}
