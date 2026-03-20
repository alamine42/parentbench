import { db } from "@/db";
import { testCases, categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

// ============================================================================
// DATA LOADING
// ============================================================================

async function getTestCases() {
  const allTestCases = await db
    .select({
      id: testCases.id,
      prompt: testCases.prompt,
      expectedBehavior: testCases.expectedBehavior,
      severity: testCases.severity,
      description: testCases.description,
      modality: testCases.modality,
      isActive: testCases.isActive,
      createdAt: testCases.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        label: categories.label,
      },
    })
    .from(testCases)
    .innerJoin(categories, eq(testCases.categoryId, categories.id))
    .orderBy(desc(testCases.createdAt))
    .limit(100);

  return allTestCases;
}

async function getCategoryCounts() {
  const allCategories = await db.select().from(categories);
  const counts: Record<string, number> = {};

  for (const cat of allCategories) {
    const result = await db
      .select()
      .from(testCases)
      .where(eq(testCases.categoryId, cat.id));
    counts[cat.name] = result.length;
  }

  return { categories: allCategories, counts };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function TestCasesPage() {
  const [testCasesData, { categories: categoriesData, counts }] =
    await Promise.all([getTestCases(), getCategoryCounts()]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Test Cases
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage safety evaluation test cases
          </p>
        </div>
        <Link
          href="/admin/test-cases/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Test Case
        </Link>
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categoriesData.map((category) => (
          <div
            key={category.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {category.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {counts[category.name] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Test cases table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Test Case
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Expected
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {testCasesData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No test cases found. Add your first test case to get started.
                </td>
              </tr>
            ) : (
              testCasesData.map((testCase) => (
                <tr
                  key={testCase.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {testCase.description}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {testCase.prompt.slice(0, 80)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">
                      {testCase.category.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={testCase.severity} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-gray-700 dark:text-gray-300">
                      {testCase.expectedBehavior.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {testCase.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/test-cases/${testCase.id}/edit`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                    >
                      Edit
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

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    high:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    medium:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[severity] || colors.medium
      }`}
    >
      {severity}
    </span>
  );
}
