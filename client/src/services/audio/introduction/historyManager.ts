// History management for audio playback

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
 * History manager class
 */
export class HistoryManager {
  private history: Story[];

  constructor() {
    this.history = [];
  }
  
  /**
   * Add story to history with deduplication
   */
  addToHistory(story: Story): Story[] {
    if (!story) return [];
    
    // Check if this story is already at the top of history
    if (this.history.length > 0) {
      const lastStory = this.history[0];
      
      // Check if it's the same story (by id and seedId)
      if (lastStory.id === story.id && lastStory.seedId === story.seedId) {
        // Don't add duplicate
        return [...this.history];
      }
    }
    
    // Add to the beginning of history
    this.history.unshift(story);
    
    // Limit history to 50 items
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }
    
    return [...this.history];
  }
  
  /**
   * Clear history
   */
  clearHistory(): Story[] {
    this.history = [];
    return [];
  }
  
  /**
   * Get history
   */
  getHistory(): Story[] {
    return [...this.history];
  }
  
  /**
   * Get previous story from history
   */
  getPrevious(): Story | null {
    if (this.history.length > 1) {
      // Current story is at index 0, previous is at index 1
      return this.history[1];
    }
    return null;
  }
  
  /**
   * Remove current from history (for back navigation)
   */
  removeCurrentFromHistory(): Story[] {
    if (this.history.length > 0) {
      this.history.shift();
    }
    return [...this.history];
  }
  
  /**
   * Check if has previous story
   */
  hasPrevious(): boolean {
    return this.history.length > 1;
  }
  
  /**
   * Get history length
   */
  getLength(): number {
    return this.history.length;
  }
}