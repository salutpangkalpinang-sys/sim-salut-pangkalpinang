import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function PenggunaPage() {
  return (
    <ModulePlaceholder
      title="Pengguna & Hak Akses"
      checkpointNumber={1}
      description="Pengelolaan akun pengguna internal dan penugasan peran (role)"
      allowedRoles={["owner"]}
    />
  );
}
