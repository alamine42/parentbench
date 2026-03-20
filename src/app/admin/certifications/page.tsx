import { db } from "@/db";
import { certifications, models, providers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

// ============================================================================
// DATA LOADING
// ============================================================================

async function getCertifications() {
  const allCertifications = await db
    .select({
      id: certifications.id,
      status: certifications.status,
      appliedAt: certifications.appliedAt,
      reviewedAt: certifications.reviewedAt,
      approvedAt: certifications.approvedAt,
      revokedAt: certifications.revokedAt,
      revokeReason: certifications.revokeReason,
      paymentAmount: certifications.paymentAmount,
      createdAt: certifications.createdAt,
      model: {
        id: models.id,
        name: models.name,
        slug: models.slug,
      },
      provider: {
        id: providers.id,
        name: providers.name,
      },
    })
    .from(certifications)
    .innerJoin(models, eq(certifications.modelId, models.id))
    .innerJoin(providers, eq(certifications.providerId, providers.id))
    .orderBy(desc(certifications.createdAt))
    .limit(100);

  return allCertifications;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function CertificationsPage() {
  const certificationsData = await getCertifications();

  // Group by status
  const statusGroups = {
    pending: certificationsData.filter((c) => c.status === "applied"),
    inReview: certificationsData.filter((c) => c.status === "in_review"),
    approved: certificationsData.filter((c) => c.status === "approved"),
    rejected: certificationsData.filter((c) => c.status === "rejected"),
    revoked: certificationsData.filter((c) => c.status === "revoked"),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Certifications
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review and manage certification applications
          </p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatusCard
          label="Pending"
          count={statusGroups.pending.length}
          color="yellow"
        />
        <StatusCard
          label="In Review"
          count={statusGroups.inReview.length}
          color="blue"
        />
        <StatusCard
          label="Approved"
          count={statusGroups.approved.length}
          color="green"
        />
        <StatusCard
          label="Rejected"
          count={statusGroups.rejected.length}
          color="red"
        />
        <StatusCard
          label="Revoked"
          count={statusGroups.revoked.length}
          color="gray"
        />
      </div>

      {/* Certifications table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Applied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {certificationsData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No certification applications yet.
                </td>
              </tr>
            ) : (
              certificationsData.map((cert) => (
                <tr
                  key={cert.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {cert.model.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {cert.model.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">
                      {cert.provider.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cert.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {cert.appliedAt
                      ? new Date(cert.appliedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {cert.paymentAmount
                      ? `$${(cert.paymentAmount / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/certifications/${cert.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================

function StatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "yellow" | "blue" | "green" | "red" | "gray";
}) {
  const colors = {
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    gray: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  };

  return (
    <div className={`rounded-lg p-4 border ${colors[color]}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {count}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    none: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    applied:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    in_review:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    approved:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    revoked: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    appealing:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const labels: Record<string, string> = {
    none: "None",
    applied: "Pending",
    in_review: "In Review",
    approved: "Approved",
    rejected: "Rejected",
    revoked: "Revoked",
    appealing: "Appealing",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] || colors.none
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
