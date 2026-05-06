/**
 * Text utility functions
 * Handles text truncation and formatting
 */

/**
 * Truncate text at a word boundary
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text ending at a word boundary with ellipsis if needed
 */
export const truncateAtWordBoundary = (text: string, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  
  // Find the last space before the maxLength
  const boundaryIndex = text.lastIndexOf(' ', maxLength);
  
  // If no space found, just cut at maxLength
  if (boundaryIndex === -1) return text.substring(0, maxLength) + '...';
  
  // Cut at word boundary and add ellipsis
  return text.substring(0, boundaryIndex) + '...';
};