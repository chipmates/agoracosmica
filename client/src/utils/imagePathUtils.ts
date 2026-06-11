/**
 * Utility functions for handling image paths with proper fallbacks
 */

/**
 * Figure object structure for image path utilities
 */
export interface FigureForImage {
  imageKey?: string;
  name?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Image type options
 */
export type ImageType = 'thumbnail' | 'main' | 'full';

/**
 * Image format options
 */
export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpg';

/**
 * Special case mapping type
 */
type SpecialCaseMap = {
  [key: string]: string;
};

/**
 * Map figure names to correct imageKey for file paths
 * @param figure - The figure object or null
 * @returns The correct key for image paths
 */
export const normalizeFigureKey = (figure: FigureForImage | null | undefined): string => {
  if (!figure) return 'default';
  
  // If the figure already has a normalized imageKey, use it
  if (figure.imageKey) {
    const key: string = figure.imageKey.toLowerCase();
    
    // Special case mappings
    const specialCases: SpecialCaseMap = {
      'leonardo': 'vinci',
      'davinci': 'vinci',
      'leonardo da vinci': 'vinci',
      'vinci': 'vinci',
      'zenji': 'zenji',
      'dōgen zenji': 'zenji',
      'siddhartha': 'gautama',
      'siddhartha gautama': 'gautama',
      'galileo': 'galilei',
      'galileo galilei': 'galilei',
      'hildegard': 'bingen',
      'hildegard von bingen': 'bingen',
      'marcus': 'aurelius',
      'marcus aurelius': 'aurelius',
      'martin luther king': 'king',
      'martin luther king jr': 'king',
      'king jr': 'king',
      // German translations mapping back to English asset names
      'platon': 'plato',
      'platons': 'plato',
      'marc aurel': 'aurelius'
    };
    
    // Check if we have a special case for this key
    if (specialCases[key]) {
      return specialCases[key];
    }
    
    return key;
  }
  
  // If no imageKey, try to extract from name
  if (figure.name) {
    const name: string = figure.name.toLowerCase().replace('echo of ', '');
    
    // Special case mappings for full names
    if (name.includes('da vinci') || name.includes('vinci')) return 'vinci';
    if (name.includes('zenji')) return 'zenji';
    if (name.includes('gautama')) return 'gautama';
    if (name.includes('galilei')) return 'galilei';
    if (name.includes('bingen')) return 'bingen';
    if (name.includes('aurel')) return 'aurelius'; // covers both Marcus Aurelius and German Marc Aurel
    if (name.includes('king') || name.includes('martin luther')) return 'king';
    if (name.includes('platon')) return 'plato'; // German translation
    
    // Default case - get last word of name
    const lastName = name.split(' ').pop();
    return lastName || 'default';
  }
  
  return 'default';
};

/**
 * Generate the appropriate thumbnail path for a figure with fallbacks
 * @param figure - The figure object
 * @param size - Desired image size (160, 320, 480)
 * @param format - Desired image format (webp, avif, png)
 * @param type - Image type (thumbnail, main)
 * @returns The image path
 */
export const getFigureImagePath = (
  figure: FigureForImage | null | undefined, 
  size: number = 320, 
  format: ImageFormat = 'webp', 
  type: ImageType = 'thumbnail'
): string => {
  // If no figure, return default image
  if (!figure) {
    return `/assets/ui/default-figure.webp`;
  }

  // Create base path with normalized key
  const figureKey: string = normalizeFigureKey(figure);
  
  // Handle special case for figures like "jr."
  if (type === 'thumbnail') {
    return `/assets/figures/thumbnails/${figureKey}-thumbnail-${size}.${format}`;
  }
  
  // For full/main images
  return `/assets/figures/full/${figureKey}-main-${size}.${format}`;
};

/**
 * Get all potential fallback paths for an image in order of preference
 * @param figure - The figure object
 * @param type - Image type (thumbnail, main)
 * @returns Array of potential fallback paths
 */
export const getImageFallbacks = (
  figure: FigureForImage | null | undefined, 
  type: ImageType = 'thumbnail'
): string[] => {
  if (!figure) {
    return [`/assets/ui/default-figure.webp`];
  }

  const figureKey: string = normalizeFigureKey(figure);
  const fallbacks: string[] = [];
  
  // Special cases for some figures that have non-standard naming patterns
  const specialCases: SpecialCaseMap = {
    'vinci': 'vinci',
    'leonardo': 'vinci',
    'davinci': 'vinci',
    'da vinci': 'vinci'
  };
  
  // Use the special case key if applicable
  const keyToUse: string = specialCases[figureKey] || figureKey;
  
  if (type === 'thumbnail') {
    // Primary choice - the size we actually want
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-320.webp`);
    
    // Alternative formats for same size
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-320.avif`);
    
    // Alternative sizes
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-480.webp`);
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-160.webp`);
    
    // PNG as last resort for thumbnails
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-480.png`);
    
    // Double thumbnail naming pattern fallback (found in some files)
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail-thumbnail-320.webp`);
    
    // Thumbnail with double-dash (specific to some figures like vinci)
    if (keyToUse === 'vinci') {
      fallbacks.push(`/assets/figures/thumbnails/${keyToUse}--thumbnail-320.webp`);
    }
    
    // Old-style naming pattern fallback
    fallbacks.push(`/assets/figures/thumbnails/${keyToUse}-thumbnail@2x.webp`);
  } else {
    // Main/full images - normal pattern
    fallbacks.push(`/assets/figures/full/${keyToUse}-main-900.webp`);
    fallbacks.push(`/assets/figures/full/${keyToUse}-main-600.webp`);
    fallbacks.push(`/assets/figures/full/${keyToUse}-main-1200.webp`);
    fallbacks.push(`/assets/figures/full/${keyToUse}-main-1800.webp`);
    
  }
  
  // Final fallback - default image
  fallbacks.push(`/assets/ui/default-figure.webp`);
  
  return fallbacks;
};

/**
 * Helper function to try loading fallback images when the primary image fails
 * @param imgElement - The image element that failed to load
 * @param fallbacks - Array of fallback paths to try
 * @param index - Current index in the fallbacks array
 */
export const tryNextFallback = (
  imgElement: HTMLImageElement, 
  fallbacks: string[], 
  index: number = 0
): void => {
  if (index >= fallbacks.length) {
    console.warn('All image fallbacks failed');
    return;
  }
  
  // Try the next fallback
  imgElement.src = fallbacks[index];
  
  // Setup handler for if this one fails too
  imgElement.onerror = () => {
    imgElement.onerror = null; // Clear the handler
    tryNextFallback(imgElement, fallbacks, index + 1);
  };
};