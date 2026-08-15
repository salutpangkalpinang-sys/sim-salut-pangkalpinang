import { ModulePlaceholder } from "@/components/layout/module-placeholder";

export default function AuditLogPage() {
  return (
    <ModulePlaceholder
      title="Audit Log"
      checkpointNumber={1}
      description="Jejak riwayat aktivitas sensitif pengguna dan perubahan data"
      allowedRoles={["owner"]}
    />
  );
}
