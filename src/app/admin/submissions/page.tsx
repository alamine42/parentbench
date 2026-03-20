import { db } from "@/db";
import { submissions, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

// ============================================================================
// DATA LOADING
// ============================================================================

async function getSubmissions() {
  const allSubmissions = await db
    .select({
      id: submissions.id,
      email: submissions.email,
      prompt: submissions.prompt,
      expectedResponse: submissions.expectedResponse,
      status: submissions.status,
      reviewNotes: submissions.reviewNotes,
      reviewedAt: submissions.reviewedAt,
      createdAt: submissions.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        label: categories.label,
      },
    })
    .from(submissions)
    .innerJoin(categories, eq(submissions.categoryId, categories.id))
    .orderBy(desc(submissions.createdAt))
    .limit(100);

  return allSubmissions;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function SubmissionsPage() {
  const submissionsData = await getSubmissions();

  // Count by status
  const pendingCount = submissionsData.filter(
    (s) => s.status === "pending"
  ).length;
  const approvedCount = submissionsData.filter(
    (s) => s.status === "approved"
  ).length;
  const rejectedCount = submissionsData.filter(
    (s) => s.status === "rejected"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Community Submissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review test case submissions from the community
          </p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pending Review
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {pendingCount}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Approved</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {approvedCount}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {rejectedCount}
          </p>
        </div>
      </div>

      {/* Submissions table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Submission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Submitted By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {submissionsData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No submissions yet.
                </td>
              </tr>
            ) : (
              submissionsData.map((submission) => (
                <tr
                  key={submission.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {submission.prompt.slice(0, 60)}...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Expected: {submission.expectedResponse.slice(0, 40)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">
                      {submission.category.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {submission.email}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={submission.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {new Date(submission.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/submissions/${submission.id}`}
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    approved:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[status] || colors.pending
      }`}
    >
      {status}
    </span>
  );
}
