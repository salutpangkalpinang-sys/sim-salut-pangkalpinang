import { getCurrentUserProfile } from "@/lib/auth/permissions";
import { getRegistrationsList, getRegistrationMasterOptions } from "@/features/registrations/queries";
import { RegistrationListContainer } from "@/components/registrations/registration-list-container";
import { redirect } from "next/navigation";

export default async function RegistrasiPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  let statusFilter: any = undefined;
  if (searchParams) {
    const resolvedParams = await searchParams;
    if (resolvedParams.status) {
      statusFilter = resolvedParams.status;
    }
  }

  const { data: registrations, total, page, limit, totalPages } = await getRegistrationsList({
    page: 1,
    limit: 20,
    status: statusFilter,
  });

  const options = await getRegistrationMasterOptions();

  return (
    <RegistrationListContainer
      initialRegistrations={registrations}
      initialTotal={total}
      initialPage={page}
      initialLimit={limit}
      initialTotalPages={totalPages}
      userRole={profile.role}
      options={options}
      initialStatusFilter={statusFilter}
    />
  );
}
