import fs from "fs/promises";
import path from "path";
import type { ModelsData, ModelInfo } from "@/types/model";

export async function getAllModels(): Promise<ModelInfo[]> {
  const filePath = path.join(process.cwd(), "data", "models.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const data: ModelsData = JSON.parse(raw);
  return data.models;
}

export async function getModelBySlug(slug: string): Promise<ModelInfo | null> {
  const models = await getAllModels();
  return models.find((m) => m.slug === slug) ?? null;
}

export async function getAllModelSlugs(): Promise<string[]> {
  const models = await getAllModels();
  return models.map((m) => m.slug);
}
