import { ClubTournamentsScreen } from "@/components/clubs/ClubTournamentsScreen";
export default async function TournamentsPage({params}:{params:Promise<{clubId:string}>}){const{clubId}=await params;return <ClubTournamentsScreen clubId={clubId}/>;}
