/**
 * Evaluation Priority Queue
 *
 * Manages evaluation job priorities based on model tiers.
 * Higher priority jobs run first when concurrency slots are available.
 */

export type EvalTier = "active" | "standard" | "maintenance" | "paused";

export interface EvalJob {
  id: string;
  tier: EvalTier;
  modelId: string;
  createdAt?: Date;
}

export interface EvalQueue {
  jobs: EvalJob[];
}

// Priority values: lower number = higher priority
const TIER_PRIORITIES: Record<EvalTier, number> = {
  active: 1,
  standard: 2,
  maintenance: 3,
  paused: 4, // Manual triggers use paused tier
};

const DEFAULT_CONCURRENCY_LIMIT = 5;

// In-memory model locks (in production, use Redis or database)
const modelLocks = new Set<string>();

/**
 * Get the priority value for a given tier.
 *
 * Lower number = higher priority.
 * Active (1) > Standard (2) > Maintenance (3) > Manual/Paused (4)
 */
export function getPriorityForTier(tier: EvalTier): number {
  return TIER_PRIORITIES[tier];
}

/**
 * Sort jobs by priority (highest first) and then by creation time (FIFO).
 *
 * Jobs with lower priority numbers run first.
 * Within the same priority, earlier jobs run first.
 */
export function sortByPriority<T extends EvalJob>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const priorityDiff = getPriorityForTier(a.tier) - getPriorityForTier(b.tier);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    // Same priority: sort by creation time (FIFO)
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return aTime - bTime;
  });
}

/**
 * Check if we can start a new evaluation given current concurrency.
 */
export function canStartEvaluation(
  currentlyRunning: number,
  limit: number = DEFAULT_CONCURRENCY_LIMIT
): boolean {
  return currentlyRunning < limit;
}

/**
 * Check if a model is currently locked (has a running evaluation).
 */
export async function isModelLocked(modelId: string): Promise<boolean> {
  return modelLocks.has(modelId);
}

/**
 * Lock a model to prevent concurrent evaluations.
 */
export async function lockModel(modelId: string): Promise<void> {
  modelLocks.add(modelId);
}

/**
 * Unlock a model after evaluation completes.
 */
export async function unlockModel(modelId: string): Promise<void> {
  modelLocks.delete(modelId);
}

/**
 * Create a new evaluation queue.
 */
export function createQueue(): EvalQueue {
  return { jobs: [] };
}

/**
 * Add a job to the queue.
 */
export function enqueue(queue: EvalQueue, job: EvalJob): void {
  queue.jobs.push(job);
}

/**
 * Remove and return the highest priority job from the queue.
 */
export function dequeue(queue: EvalQueue): EvalJob | undefined {
  if (queue.jobs.length === 0) {
    return undefined;
  }

  // Sort and take the first (highest priority)
  const sorted = sortByPriority(queue.jobs);
  const job = sorted[0];

  // Remove from queue
  const index = queue.jobs.findIndex((j) => j.id === job.id);
  if (index !== -1) {
    queue.jobs.splice(index, 1);
  }

  return job;
}

/**
 * Get the next job that can be executed (not locked).
 *
 * Skips models that are currently locked.
 */
export async function dequeueNext(queue: EvalQueue): Promise<EvalJob | undefined> {
  if (queue.jobs.length === 0) {
    return undefined;
  }

  // Sort by priority
  const sorted = sortByPriority(queue.jobs);

  // Find the first job whose model is not locked
  for (const job of sorted) {
    const locked = await isModelLocked(job.modelId);
    if (!locked) {
      // Remove from queue
      const index = queue.jobs.findIndex((j) => j.id === job.id);
      if (index !== -1) {
        queue.jobs.splice(index, 1);
      }
      return job;
    }
  }

  // All jobs are for locked models
  return undefined;
}

/**
 * Get the Inngest function configuration for priority-based execution.
 */
export function getInngestPriorityConfig() {
  return {
    concurrency: {
      limit: DEFAULT_CONCURRENCY_LIMIT,
      key: "event.data.modelId", // Serialize by model
    },
    priority: {
      run: "event.data.priority", // Priority from event data
    },
  };
}

/**
 * Clear all model locks (for testing).
 * @internal
 */
export function _clearModelLocks(): void {
  modelLocks.clear();
}
