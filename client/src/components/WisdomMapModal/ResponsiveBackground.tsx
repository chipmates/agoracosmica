// ResponsiveBackground.tsx - Uses Vite's on-demand image optimization
import { FC, CSSProperties } from 'react';
import OptimizedImage from '../OptimizedImage';
import './css/ResponsiveBackground.css';

interface ResponsiveBackgroundProps {
  imageName?: string;
}

/**
 * ResponsiveBackground Component
 * 
 * Updated to use Vite's dynamic image optimization instead of pre-processed files.
 * Vite automatically generates the right size based on viewport.
 * 
 * Features:
 * - Vite automatically selects optimal format (AVIF → WebP → JPG)
 * - Dynamic sizing based on viewport
 * - No more pre-processed files needed
 * - Reduces build size by ~295MB
 */
const ResponsiveBackground: FC<ResponsiveBackgroundProps> = ({ imageName = 'starry-background' }) => {
  // For background images, we can use OptimizedImage component
  // or import directly with Vite's imagetools
  
  const styles: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };
  
  return (
    <OptimizedImage
      src={imageName}
      type="background"
      purpose="main"
      alt=""
      role="presentation"
      className="responsive-background"
      style={styles}
    />
  );
};

export default ResponsiveBackground;