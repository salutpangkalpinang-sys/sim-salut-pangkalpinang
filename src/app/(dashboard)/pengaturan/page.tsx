import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function PengaturanPage() {
  return (
    <ModulePlaceholder
      title="Pengaturan Sistem"
      checkpointNumber={1}
      description="Konfigurasi parameter aplikasi, identitas SALUT, dan default fee"
      allowedRoles={["owner", "academic_admin", "finance_admin"]}
    />
  );
}
