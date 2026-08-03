import { LiveRoomScreen } from "@/components/clubs/LiveRoomScreen";
export default async function LiveRoomPage({params}:{params:Promise<{clubId:string;roomId:string}>}){const{clubId,roomId}=await params;return <LiveRoomScreen clubId={clubId} roomId={roomId}/>;}
