/**
 * OptimizedFigureImage Component
 *
 * A specialized component for figure images that provides:
 * - Format negotiation (AVIF, WebP, PNG fallback)
 * - Responsive sizing based on screen resolution
 * - Optimized for both thumbnail and full-size images
 * - Uses Vite's import.meta.glob() for dynamic image loading
 */
import React, { FC, useState, useEffect, useCallback, CSSProperties } from 'react';
import { normalizeFigureKey } from '../utils/imagePathUtils';
import { loadFigureImageV2, getBestImageFromMetadata, type ImageResult } from '../utils/imageLoaderV2';
import './OptimizedUIImage.css'; // Reuse the base styles

type ImageType = 'thumbnail' | 'main';
type ImageFormat = 'avif' | 'webp' | 'png';

// Use ImageResult from imageLoaderV2 for consistency
type ImageData = ImageResult;

interface Figure {
  imageKey?: string;
  [key: string]: any;
}

interface OptimizedFigureImageProps {
  /** Figure object or figure identifier string */
  figure: Figure | string;
  /** Type of image ('thumbnail' or 'main') */
  type?: ImageType;
  /** Explicit size to use */
  size?: number;
  /** Preferred format */
  format?: ImageFormat;
  /** Whether this image should be loaded with priority */
  priority?: boolean;
  /** Whether to use blur-up loading effect */
  withBlurUp?: boolean;
  /** Whether this figure is currently active/selected */
  isActive?: boolean;
  /** Whether audio is currently playing for this figure */
  isPlaying?: boolean;
  /** Callback when image is loaded */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: (error: any) => void;
  /** Additional class name */
  className?: string;
  /** Alt text for the image */
  alt?: string;
  /** Additional props to pass to the img element */
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  /** Additional inline styles */
  style?: CSSProperties;
  [key: string]: any;
}

/**
 * Custom hook to determine the appropriate image size based on screen and type
 * @param {string} type - Type of image ('thumbnail' or 'main')
 * @param {number|undefined} explicitSize - Size specified by props
 * @returns {number} The calculated image size to use
 */
function useResponsiveImageSize(type: ImageType = 'thumbnail', explicitSize?: number): number {
  const calculateSize = useCallback(() => {
    if (explicitSize) return explicitSize;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const effectiveSize = Math.max(width, height) * dpr;
    
    if (type === 'thumbnail') {
      // For thumbnails, we want smaller sizes but consider DPR for crisp display
      // CSS miniatures are 80px-144px, so with DPR we need 160px-288px actual pixels
      if (effectiveSize > 2560) return 480; // 4K+ high-DPI
      else if (effectiveSize > 1920) return 480; // Large high-DPI displays  
      else if (effectiveSize > 1280) return 320; // Standard high-DPI
      else return 160; // Basic displays
    } else {
      // For main/full images, use larger sizes
      if (effectiveSize > 2560) return 2400;
      else if (effectiveSize > 1920) return 1800;
      else if (effectiveSize > 1280) return 1200;
      else if (effectiveSize > 768) return 900;
      else return 600;
    }
  }, [type, explicitSize]);
  
  const [size, setSize] = useState(calculateSize);
  
  useEffect(() => {
    // Update size when window resizes
    const handleResize = () => {
      setSize(calculateSize());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateSize]);
  
  return size;
}

interface UseImageLoadingOptions {
  onLoad?: () => void;
  onError?: (error: any) => void;
}

interface UseImageLoadingReturn {
  loaded: boolean;
  error: boolean;
  handleLoad: () => void;
  handleError: (err: any) => void;
}

/**
 * Custom hook to handle image loading and error states
 */
function useImageLoading({ onLoad, onError }: UseImageLoadingOptions): UseImageLoadingReturn {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  const handleLoad = useCallback(() => {
    setLoaded(true);
    if (onLoad) onLoad();
  }, [onLoad]);
  
  const handleError = useCallback((err: any) => {
    setError(true);
    if (onError) onError(err);
  }, [onError]);
  
  return { loaded, error, handleLoad, handleError };
}

interface UseImagePathsReturn {
  imageData: ImageData | null;
  loading: boolean;
}

/**
 * Load image paths dynamically using Vite's imagetools
 */
function useImagePaths(
  figure: Figure | string | undefined,
  type: ImageType,
  size: number,
  format: ImageFormat
): UseImagePathsReturn {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!figure) {
      setImageData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const figureKey = normalizeFigureKey(typeof figure === 'string' ? { imageKey: figure } : figure);

    const loadImages = async () => {
      setLoading(true);
      try {
        const metadata = await loadFigureImageV2(figureKey, type);
        if (cancelled) return;

        if (metadata) {
          const bestImages = getBestImageFromMetadata(metadata, size, format);
          setImageData(bestImages);
        } else {
          setImageData(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load figure images:', error);
        setImageData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadImages();

    return () => { cancelled = true; };
  }, [figure, type, size, format]);
  
  return { imageData, loading };
}

/**
 * OptimizedFigureImage Component
 * 
 * @param {Object} props - Component props
 * @param {Object|string} props.figure - The figure object or figure key string
 * @param {string} props.type - Type of image ('thumbnail' or 'main')
 * @param {number} props.size - Explicit size to use (optional)
 * @param {string} props.format - Preferred format (avif, webp, png)
 * @param {boolean} props.priority - Whether image should be loaded with priority
 * @param {boolean} props.withBlurUp - Whether to use blur-up loading effect
 * @param {Function} props.onLoad - Callback when image loads
 * @param {Function} props.onError - Callback when image fails to load
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.imgProps - Additional props to pass to img element
 * @param {Object} props.style - Additional inline styles
 */
const OptimizedFigureImage: FC<OptimizedFigureImageProps> = ({
  figure,
  type = 'thumbnail',
  size,
  format = 'webp',
  priority = false,
  withBlurUp = false,
  onLoad,
  onError,
  className = '',
  imgProps = {},
  style = {},
  alt = '',
  isActive = false,
  isPlaying = false,
  ...props
}) => {
  const calculatedSize = useResponsiveImageSize(type, size);
  const { imageData, loading: pathsLoading } = useImagePaths(figure, type, calculatedSize, format);
  const { loaded, error, handleLoad, handleError } = useImageLoading({ onLoad, onError });
  
  // Show loading state while paths are being resolved
  if (pathsLoading) {
    return (
      <div 
        className={`optimized-ui-image optimized-ui-image--loading ${className}`}
        style={{
          backgroundColor: 'rgba(28, 36, 92, 0.3)',
          borderRadius: type === 'thumbnail' ? '50%' : '4px',
          aspectRatio: type === 'thumbnail' ? '1/1' : 'auto',
          ...style
        }}
        {...props}
      />
    );
  }
  
  // For missing images
  if (!imageData || !imageData.primary) {
    return (
      <div 
        className={`optimized-ui-image optimized-ui-image--missing ${className}`}
        style={{
          backgroundColor: 'rgba(28, 36, 92, 0.5)',
          color: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderRadius: type === 'thumbnail' ? '50%' : '4px',
          aspectRatio: type === 'thumbnail' ? '1/1' : 'auto',
          ...style
        }}
        role="img"
        aria-label={alt || `Image of figure unavailable`}
        {...props}
      >
        <span>{typeof figure === 'string' ? figure : 'Figure'}</span>
      </div>
    );
  }
  
  // Apply blur-up effect class conditionally
  const imageClasses = `
    optimized-ui-image__img 
    ${loaded ? 'optimized-ui-image__img--loaded' : ''} 
    ${withBlurUp && !loaded ? 'optimized-ui-image__img--blurry' : ''}
  `;
  
  // Render using picture element for format negotiation
  return (
    <div 
      className={`optimized-ui-image optimized-figure-image optimized-figure-image--${type} ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
      {...props}
    >
      {/* Add glow effect for active figure if type is thumbnail */}
      {type === 'thumbnail' && isActive && (
        <div className="optimized-figure-image__glow"></div>
      )}
      
      <picture>
        {/* AVIF source */}
        {imageData.avif && (
          <source 
            srcSet={imageData.avif.srcSet} 
            type="image/avif"
            sizes={`(max-width: 640px) 100vw, ${imageData.avif.width}px`}
          />
        )}
        
        {/* WebP source */}
        {imageData.webp && (
          <source 
            srcSet={imageData.webp.srcSet} 
            type="image/webp"
            sizes={`(max-width: 640px) 100vw, ${imageData.webp.width}px`}
          />
        )}
        
        {/* PNG fallback */}
        <img
          src={imageData.primary}
          alt={alt || (typeof figure === 'string' ? figure : 'Figure image')}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          width={imageData.width ?? undefined}
          height={imageData.height ?? undefined}
          className={imageClasses}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            // 2025 ARCHITECTURE: Parent components control object-fit via CSS
            // Removed inline objectFit and objectPosition to allow proper CSS cascade
            width: '100%',
            height: '100%',
            borderRadius: type === 'thumbnail' ? '50%' : '0',
            verticalAlign: 'middle'
          }}
          decoding="async"
          {...imgProps}
        />
      </picture>
      
      {/* Subtle pulse animation for playing status */}
      {isPlaying && (
        <div className="optimized-figure-image__pulse-overlay"></div>
      )}
    </div>
  );
};

// Export memoized component for performance
export default React.memo(OptimizedFigureImage);