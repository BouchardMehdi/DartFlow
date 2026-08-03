import { ClubRoomsScreen } from "@/components/clubs/ClubRoomsScreen";
export default async function ClubLivePage({params}:{params:Promise<{clubId:string}>}){const{clubId}=await params;return <ClubRoomsScreen clubId={clubId}/>;}
