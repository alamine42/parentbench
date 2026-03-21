import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { ParentBenchCategory } from "@/types/parentbench";

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    textAlign: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#171717",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 20,
  },
  modelInfo: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modelName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#171717",
    marginBottom: 4,
  },
  providerName: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 8,
  },
  evaluationDate: {
    fontSize: 10,
    color: "#888888",
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  overallScore: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#171717",
  },
  overallGrade: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  overallLabel: {
    fontSize: 12,
    color: "#666666",
    marginTop: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#171717",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  categoryItem: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryLabel: {
    fontSize: 11,
    color: "#374151",
    flex: 1,
  },
  categoryBar: {
    width: 150,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 10,
  },
  categoryBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  categoryScore: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#171717",
    width: 30,
    textAlign: "right",
  },
  categoryGrade: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    width: 24,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  footerText: {
    fontSize: 9,
    color: "#888888",
    textAlign: "center",
  },
  verifyLink: {
    fontSize: 9,
    color: "#3B82F6",
    textAlign: "center",
    marginTop: 4,
  },
  qrSection: {
    alignItems: "center",
    marginTop: 20,
  },
  qrLabel: {
    fontSize: 9,
    color: "#888888",
    marginTop: 8,
  },
});

// Helper to get grade color
function getGradeColor(grade: string): string {
  if (grade.startsWith("A") || grade === "B+") return "#22C55E"; // green
  if (grade.startsWith("B") || grade.startsWith("C")) return "#F59E0B"; // amber
  return "#EF4444"; // red
}

// Helper to get bar color
function getBarColor(score: number): string {
  if (score >= 80) return "#22C55E";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

// Category labels
const CATEGORY_LABELS: Record<ParentBenchCategory, string> = {
  age_inappropriate_content: "Age-Inappropriate Content",
  manipulation_resistance: "Manipulation Resistance",
  data_privacy_minors: "Data Privacy (Minors)",
  parental_controls_respect: "Parental Controls Respect",
};

export type ReportCardData = {
  modelName: string;
  modelSlug: string;
  providerName: string;
  overallScore: number;
  overallGrade: string;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
  evaluatedDate: string;
  reportId: string;
  verifyUrl: string;
};

export function ReportCardDocument({ data }: { data: ReportCardData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>PARENTBENCH</Text>
          <Text style={styles.tagline}>AI Safety Report Card</Text>
        </View>

        {/* Model Info */}
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>{data.modelName}</Text>
          <Text style={styles.providerName}>{data.providerName}</Text>
          <Text style={styles.evaluationDate}>
            Evaluation Date: {new Date(data.evaluatedDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Overall Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.overallScore}>{data.overallScore}</Text>
          <Text style={[styles.overallGrade, { backgroundColor: getGradeColor(data.overallGrade) }]}>
            {data.overallGrade}
          </Text>
          <Text style={styles.overallLabel}>Overall Child Safety Score</Text>
        </View>

        {/* Category Breakdown */}
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Category Breakdown</Text>
          {data.categoryScores.map((cat) => (
            <View key={cat.category} style={styles.categoryItem}>
              <Text style={styles.categoryLabel}>
                {CATEGORY_LABELS[cat.category as ParentBenchCategory] || cat.category}
              </Text>
              <View style={styles.categoryBar}>
                <View
                  style={[
                    styles.categoryBarFill,
                    {
                      width: `${cat.score}%`,
                      backgroundColor: getBarColor(cat.score),
                    },
                  ]}
                />
              </View>
              <Text style={styles.categoryScore}>{cat.score}</Text>
              <Text style={[styles.categoryGrade, { backgroundColor: getGradeColor(cat.grade) }]}>
                {cat.grade}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Verified by ParentBench | Report ID: {data.reportId}
          </Text>
          <Link src={data.verifyUrl} style={styles.verifyLink}>
            {data.verifyUrl}
          </Link>
        </View>
      </Page>
    </Document>
  );
}
