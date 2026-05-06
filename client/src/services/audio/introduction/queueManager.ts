// Queue management for audio playback

interface Story {
  id?: string;
  seedId: string | number;
  title?: string;
  figureId?: string;
  figureName?: string;
  language?: string;
  [key: string]: any;
}

/**
 * Queue manager class
 */
export class QueueManager {
  private queue: Story[];

  constructor() {
    this.queue = [];
  }
  
  /**
   * Add story to queue
   */
  addToQueue(story: Story, figureName: string | null = null): Story[] {
    // If figureName is provided, update the story object
    const enhancedStory = figureName 
      ? { ...story, figureId: figureName.toLowerCase() }
      : story;
    
    this.queue.push(enhancedStory);
    return [...this.queue];
  }
  
  /**
   * Remove story from queue
   */
  removeFromQueue(index: number): Story[] | null {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      return [...this.queue];
    }
    return null;
  }
  
  /**
   * Clear the queue
   */
  clearQueue(): Story[] {
    this.queue = [];
    return [];
  }
  
  /**
   * Set the entire queue
   */
  setQueue(newQueue: Story[]): Story[] {
    this.queue = newQueue || [];
    return [...this.queue];
  }
  
  /**
   * Get current queue
   */
  getQueue(): Story[] {
    return [...this.queue];
  }
  
  /**
   * Get next item from queue
   */
  getNext(): Story | undefined {
    if (this.queue.length > 0) {
      return this.queue.shift();
    }
    return undefined;
  }
  
  /**
   * Check if queue has items
   */
  hasItems(): boolean {
    return this.queue.length > 0;
  }
  
  /**
   * Get queue length
   */
  getLength(): number {
    return this.queue.length;
  }
}