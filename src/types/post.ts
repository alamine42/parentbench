export interface Post {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  author: string;
  category: "evaluation" | "methodology" | "announcement";
  content: PostSection[];
  relatedModels?: string[];
}

export interface PostSection {
  type: "paragraph" | "heading" | "list" | "callout";
  content: string;
  items?: string[];
  variant?: "info" | "warning" | "success";
}

export const categoryLabels: Record<Post["category"], string> = {
  evaluation: "Model Evaluation",
  methodology: "Methodology",
  announcement: "Announcement",
};
