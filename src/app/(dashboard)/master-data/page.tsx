import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getAllMasterData } from "@/features/master-data/queries";
import { MasterDataContainer } from "@/components/master-data/master-data-container";
import { redirect } from "next/navigation";

export default async function MasterDataPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const masterData = await getAllMasterData();

  return <MasterDataContainer data={masterData} userRole={profile.role} />;
}

