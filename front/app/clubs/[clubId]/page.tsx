import { ClubDetailScreen } from "@/components/clubs/ClubDetailScreen";
export default async function ClubPage({params}:{params:Promise<{clubId:string}>}){const{clubId}=await params;return <ClubDetailScreen clubId={clubId}/>;}
