import { TournamentDetailScreen } from "@/components/clubs/TournamentDetailScreen";
export default async function TournamentPage({params}:{params:Promise<{clubId:string;tournamentId:string}>}){const{clubId,tournamentId}=await params;return <TournamentDetailScreen clubId={clubId} tournamentId={tournamentId}/>;}
