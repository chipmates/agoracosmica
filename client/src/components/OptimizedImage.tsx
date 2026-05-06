/**
 * OptimizedImage Component - R2-backed responsive images
 *
 * A modern image component that supports:
 * - Multi-format images (AVIF/WebP/PNG) served from R2
 * - Responsive sizing with srcset
 * - Progressive loading with blur-up technique
 * - Screen-aware size selection
 * - Accessibility best practices
 * - Core Web Vitals optimization
 */
import React, { FC, useState, useEffect, useCallback, CSSProperties } from 'react';
import { loadUIImageV2, loadBackgroundImageV2, loadFigureImageV2, loadIconImageV2, getBestImageFromMetadata } from '../utils/imageLoaderV2';
import './OptimizedImage.css';

type ImageType = 'ui' | 'icon' | 'background';
type ImagePurpose = 'main' | 'thumbnail' | 'icon';
type ImageFormat = 'avif' | 'webp' | 'png';

interface ImageSource {
  srcSet?: string;
  width?: number;
  height?: number;
}

interface ImageData {
  primary?: string;
  avif?: ImageSource;
  webp?: ImageSource;
  width?: number;
  height?: number;
}

interface OptimizedImageProps {
  /** Image source name (without extension) */
  src?: string;
  /** Alternative prop for src (backward compat) */
  name?: string;
  /** Type of image - 'ui', 'icon', 'background' */
  type?: ImageType;
  /** Image purpose - 'main' for full images, 'thumbnail' for smaller versions, 'icon' for UI icons */
  purpose?: ImagePurpose;
  /** Explicit size to use (if not provided, will be calculated based on screen) */
  size?: number | string;
  /** Alternative prop for size (backward compat) - can be vh units */
  height?: number | string;
  /** Preferred format */
  format?: ImageFormat;
  /** Whether this image should be loaded with priority */
  priority?: boolean;
  /** Whether to use blur-up loading technique */
  withBlurUp?: boolean;
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
  /** Fetch priority attribute */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Loading attribute */
  loading?: 'eager' | 'lazy';
  /** Decoding attribute */
  decoding?: 'async' | 'sync' | 'auto';
  [key: string]: any;
}

/**
 * Helper to detect if an image name is a historical figure
 * @param {string} imageName - The image name to check
 * @returns {boolean} True if it's a figure name
 */
function isFigureName(imageName: string): boolean {
  const figureNames = [
    'einstein', 'plato', 'aurelius', 'laozi', 'bingen', 'rumi', 'eckhart', 'zenji',
    'jung', 'campbell', 'gandhi', 'mandela', 'king', 'tubman', 'beauvoir', 'angelou',
    'nietzsche', 'kahlo', 'schopenhauer', 'lovelace', 'shakespeare', 'vinci', 'mozart',
    'goethe', 'galilei', 'blake', 'austen', 'dickinson', 'woolf', 'gautama', 'user'
  ];
  return figureNames.includes(imageName);
}

/**
 * Helper to detect if an image name is an icon
 * @param {string} imageName - The image name to check
 * @returns {boolean} True if it's an icon name
 */
function isIconName(imageName: string): boolean {
  const iconNames = ['settings', 'paths', 'library', 'council'];
  return iconNames.includes(imageName);
}

/**
 * Custom hook to determine the appropriate image size based on screen
 * @param {string} purpose - 'main', 'thumbnail', 'icon', or 'background'
 * @param {number|null} explicitSize - Size specified by props
 * @param {string} type - Type of image ('ui', 'icon', 'background')
 * @returns {number} The calculated image size to use
 */
function useResponsiveSize(purpose: ImagePurpose, explicitSize: number | null, type: ImageType): number {
  const calculateSize = useCallback(() => {
    if (explicitSize) return explicitSize;
    
    const width = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    
    if (purpose === 'main') {
      // Select size based on screen dimensions and DPR
      // Sizes available: 600, 900, 1200, 1800, 2400
      const effectiveWidth = width * dpr;
      if (effectiveWidth > 1800) return 2400;
      else if (effectiveWidth > 1200) return 1800;
      else if (effectiveWidth > 900) return 1200;
      else if (effectiveWidth > 600) return 900;
      else return 600;
    } else if (purpose === 'icon') {
      // Smart responsive sizing for icons
      // Sizes available: 64, 128, 256, 384, 512
      const targetDisplaySize = width <= 768 ? 48 : 64;  // Base display size
      const idealSize = targetDisplaySize * dpr;
      
      if (idealSize <= 64) return 64;
      else if (idealSize <= 128) return 128;
      else if (idealSize <= 256) return 256;
      else if (idealSize <= 384) return 384;
      else return 512;
    } else if (purpose === 'thumbnail') {
      // For thumbnails, select based on DPR and usage context
      // Sizes available: 160, 320, 480, 640
      const idealSize = 160 * dpr;  // Base size of 160px
      
      if (idealSize <= 160) return 160;
      else if (idealSize <= 320) return 320;
      else if (idealSize <= 480) return 480;
      else return 640;
    } else if (type === 'background') {
      // For backgrounds, select based on screen width
      // Sizes available: 768, 1080, 1440, 1920, 2400, 3840
      const effectiveWidth = width * dpr;
      
      if (effectiveWidth <= 768) return 768;
      else if (effectiveWidth <= 1080) return 1080;
      else if (effectiveWidth <= 1440) return 1440;
      else if (effectiveWidth <= 1920) return 1920;
      else if (effectiveWidth <= 2400) return 2400;
      else return 3840;  // 4K displays
    } else {
      // Default fallback for other purposes (UI elements)
      // Sizes available: 240, 480, 720, 960, 1440
      const effectiveWidth = width * dpr;
      
      if (effectiveWidth <= 480) return 240;
      else if (effectiveWidth <= 960) return 480;
      else if (effectiveWidth <= 1440) return 720;
      else if (effectiveWidth <= 1920) return 960;
      else return 1440;
    }
  }, [purpose, explicitSize, type]);
  
  const [size, setSize] = useState(calculateSize);
  
  useEffect(() => {
    // Update size when window resizes (not needed for icons)
    if (purpose === 'icon') return;
    
    const handleResize = () => {
      setSize(calculateSize());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateSize, purpose]);
  
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

interface UseOptimizedImagesReturn {
  imageData: ImageData | null;
  loading: boolean;
}

/**
 * Load images from R2 via imageLoaderV2
 */
function useOptimizedImages(
  imageName: string | undefined,
  type: ImageType,
  size: number,
  format: ImageFormat,
  purpose: ImagePurpose
): UseOptimizedImagesReturn {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!imageName) {
      setImageData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadImages = async () => {
      setLoading(true);
      try {
        let metadata = null;

        // Determine which loader to use based on type and image name
        if (type === 'background') {
          metadata = await loadBackgroundImageV2(imageName);
        } else if (type === 'ui' && isFigureName(imageName)) {
          metadata = await loadFigureImageV2(imageName, purpose === 'thumbnail' ? 'thumbnail' : 'main');
        } else if (isIconName(imageName) || purpose === 'icon') {
          metadata = await loadIconImageV2(imageName);
        } else {
          metadata = await loadUIImageV2(imageName);
        }

        if (cancelled) return;

        if (metadata) {
          const bestImages = getBestImageFromMetadata(metadata, size, format);
          setImageData(bestImages as ImageData | null);
        } else {
          setImageData(null);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load image:', error);
        setImageData(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadImages();

    return () => { cancelled = true; };
  }, [imageName, type, size, format, purpose]);
  
  return { imageData, loading };
}

const OptimizedImage: FC<OptimizedImageProps> = ({
  src,
  name, // Alias for src (backward compat with OptimizedUIImageV2)
  type = 'ui', // 'ui', 'icon', 'background'
  purpose = 'main', // 'main', 'thumbnail', 'icon'
  size: explicitSize,
  height, // Alias for size (backward compat with OptimizedUIImageV2)
  format = 'webp',
  priority = false,
  withBlurUp = true,
  onLoad,
  onError,
  className = '',
  imgProps = {},
  style = {},
  // Image-specific attributes
  fetchPriority,
  loading,
  decoding,
  alt = '',
  ...props
}) => {
  // Support both 'src' and 'name' props for backward compatibility
  const imageName = src || name;
  
  // Support both 'size' and 'height' props, handle vh units
  const sizeValue = explicitSize || height;
  const isVhHeight = typeof sizeValue === 'string' && sizeValue.includes('vh');
  const effectiveSize = isVhHeight ? null : typeof sizeValue === 'number' ? sizeValue : null;
  const size = useResponsiveSize(purpose, effectiveSize, type);
  const { imageData, loading: pathsLoading } = useOptimizedImages(imageName, type, size, format, purpose);
  const { loaded, error, handleLoad, handleError } = useImageLoading({ onLoad, onError });
  
  // Show loading state while images are being loaded
  if (pathsLoading) {
    return (
      <div 
        className={`optimized-image optimized-image--loading ${className}`}
        style={{
          backgroundColor: 'rgba(28, 36, 92, 0.3)',
          borderRadius: '4px',
          ...style
        }}
        {...props}
      />
    );
  }
  
  // Render an error/missing state
  if (!imageData || !imageData.primary) {
    return (
      <div 
        className={`optimized-image optimized-image--missing ${className}`}
        style={{
          backgroundColor: 'var(--primary-deep, #1C245C)',
          color: 'var(--text-color, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          padding: '16px',
          ...style
        }}
        role="img"
        aria-label={alt || 'Image unavailable'}
        {...props}
      >
        <span>Image unavailable</span>
      </div>
    );
  }
  
  // Apply blur-up effect class conditionally
  const imageClasses = `
    optimized-image__img 
    ${loaded ? 'optimized-image__img--loaded' : ''} 
    ${withBlurUp && !loaded ? 'optimized-image__img--blurry' : ''}
  `;
  
  // Main optimized image with picture element
  return (
    <div 
      className={`optimized-image optimized-image--${purpose} ${loaded ? 'optimized-image--loaded' : ''} ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        // Apply height when vh units are provided
        ...(isVhHeight ? { height: sizeValue } : {}),
        ...style
      }}
      {...props}
    >
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
          alt={alt}
          loading={loading || (priority ? "eager" : "lazy")}
          decoding={decoding || "async"}
          fetchpriority={fetchPriority || (priority ? "high" : "auto")}
          width={imageData.width}
          height={imageData.height}
          className={imageClasses}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            // 2025 ARCHITECTURE: Parent components control object-fit via CSS
            // Removed inline objectFit and objectPosition to allow proper CSS cascade
            width: '100%',
            height: '100%'
          }}
          {...imgProps}
        />
      </picture>
    </div>
  );
};

// Memoize the component for performance
export default React.memo(OptimizedImage);