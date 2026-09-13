import { Beat, BreakdownData, BreakdownItem, BreakdownCategory } from '../types';
import { generateBreakdown } from './gemini';

export interface BatchProgressState {
  isRunning: boolean;
  isPaused: boolean;
  totalScenes: number;
  completedCount: number;
  currentSceneNumber: string;
  currentSceneLocation: string;
  percent: number;
  startTime: number;
  estimatedSecondsRemaining: number;
  processedBeatIds: number[];
  failedBeatIds: number[];
}

type ProgressListener = (state: BatchProgressState) => void;
type BeatCompletedCallback = (updatedBeat: Beat) => void;

class BatchBreakdownManager {
  private state: BatchProgressState = {
    isRunning: false,
    isPaused: false,
    totalScenes: 0,
    completedCount: 0,
    currentSceneNumber: '',
    currentSceneLocation: '',
    percent: 0,
    startTime: 0,
    estimatedSecondsRemaining: 0,
    processedBeatIds: [],
    failedBeatIds: [],
  };

  private listeners: Set<ProgressListener> = new Set();
  private abortController: AbortController | null = null;
  private queue: Beat[] = [];
  private onBeatCompletedCb: BeatCompletedCallback | null = null;
  private activeLanguage: 'english' | 'tamil' = 'english';
  private activeModel: string = 'gemini-2.5-flash';
  private openRouterApiKey?: string;

  public getState(): BatchProgressState {
    return { ...this.state };
  }

  public subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async startBatch(
    beatsToProcess: Beat[],
    language: 'english' | 'tamil' = 'english',
    model: string = 'gemini-2.5-flash',
    openRouterApiKey: string | undefined,
    onBeatCompleted: BeatCompletedCallback
  ) {
    if (this.state.isRunning) {
      console.warn('Batch breakdown is already running.');
      return;
    }

    if (!beatsToProcess || beatsToProcess.length === 0) return;

    this.queue = [...beatsToProcess];
    this.onBeatCompletedCb = onBeatCompleted;
    this.activeLanguage = language;
    this.activeModel = model;
    this.openRouterApiKey = openRouterApiKey;
    this.abortController = new AbortController();

    this.state = {
      isRunning: true,
      isPaused: false,
      totalScenes: beatsToProcess.length,
      completedCount: 0,
      currentSceneNumber: beatsToProcess[0]?.sceneNumber || `#${beatsToProcess[0]?.id || 1}`,
      currentSceneLocation: beatsToProcess[0]?.slug?.location || 'LOCATION',
      percent: 0,
      startTime: Date.now(),
      estimatedSecondsRemaining: Math.ceil(beatsToProcess.length * 2),
      processedBeatIds: [],
      failedBeatIds: [],
    };

    this.notify();
    this.runQueue();
  }

  public pause() {
    if (this.state.isRunning && !this.state.isPaused) {
      this.state.isPaused = true;
      this.notify();
    }
  }

  public resume() {
    if (this.state.isRunning && this.state.isPaused) {
      this.state.isPaused = false;
      this.notify();
    }
  }

  public cancel() {
    if (this.state.isRunning) {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.queue = [];
      this.state.isRunning = false;
      this.state.isPaused = false;
      this.notify();
    }
  }

  private async runQueue() {
    while (this.queue.length > 0 && this.state.isRunning) {
      if (this.state.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      if (this.abortController?.signal.aborted) {
        break;
      }

      const beat = this.queue.shift();
      if (!beat) break;

      this.state.currentSceneNumber = beat.sceneNumber || `#${beat.id}`;
      this.state.currentSceneLocation = beat.slug?.location || 'LOCATION';
      this.notify();

      try {
        const textContent = beat.content ? beat.content.replace(/<[^>]*>/g, ' ').trim() : '';
        const scriptTextToAnalyze = textContent || `${beat.slug?.prefix || 'INT.'} ${beat.slug?.location || 'LOCATION'} - ${beat.slug?.time || 'DAY'}\n${beat.summary || beat.title || ''}`;

        const result = await generateBreakdown(
          scriptTextToAnalyze,
          this.activeModel,
          this.activeLanguage,
          this.openRouterApiKey
        );

        if (result) {
          const updatedBeat: Beat = {
            ...beat,
            breakdownData: result,
          };

          if (this.onBeatCompletedCb) {
            this.onBeatCompletedCb(updatedBeat);
          }
          this.state.processedBeatIds.push(beat.id);
        }
      } catch (err) {
        console.error(`Error breaking down beat ${beat.id}:`, err);
        this.state.failedBeatIds.push(beat.id);
      }

      this.state.completedCount++;
      const completed = this.state.completedCount;
      const total = this.state.totalScenes;
      this.state.percent = Math.round((completed / total) * 100);

      const elapsedMs = Date.now() - this.state.startTime;
      const avgTimePerSceneMs = elapsedMs / completed;
      const remainingScenes = total - completed;
      this.state.estimatedSecondsRemaining = Math.max(0, Math.ceil((remainingScenes * avgTimePerSceneMs) / 1000));

      this.notify();

      // Gentle pause to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    this.state.isRunning = false;
    this.state.isPaused = false;
    this.notify();
  }
}

export const batchBreakdownManager = new BatchBreakdownManager();
