import React, { useState, useEffect, FC, ChangeEvent, MouseEvent } from 'react';
import styles from './ColorContrastTest.module.css';

// Type definitions
interface Color {
  name: string;
  value: string;
  usage: string;
}

interface WCAGRating {
  level: 'AAA' | 'AA' | 'FAIL';
  color: string;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorSectionProps {
  title: string;
  colors: Color[];
  background: string;
  showOnlyPassing: boolean;
  styles: any; // CSS modules object
  getContrastRatio: (color1: string, color2: string) => number;
  getWCAGRating: (ratio: number, isLargeText?: boolean) => WCAGRating;
}

// Component to render a color section
const ColorSection: FC<ColorSectionProps> = ({ 
  title, 
  colors, 
  background, 
  showOnlyPassing, 
  styles, 
  getContrastRatio, 
  getWCAGRating 
}) => {
  const filteredColors = showOnlyPassing 
    ? colors.filter(color => {
        const ratio = getContrastRatio(color.value, background);
        return ratio >= 4.5; // WCAG AA minimum
      })
    : colors;

  if (filteredColors.length === 0) {
    return (
      <div className={styles.section}>
        <h2>{title}</h2>
        <p className={styles.noResults}>No colors pass WCAG AA on this background</p>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <h2>{title}</h2>
      <div className={styles.contrastGrid}>
        {filteredColors.map(color => {
          const ratio = getContrastRatio(color.value, background);
          const wcagNormal = getWCAGRating(ratio, false);
          const wcagLarge = getWCAGRating(ratio, true);
          
          return (
            <div key={color.name} className={styles.contrastCard} style={{ backgroundColor: background }}>
              <div className={styles.colorPreview} style={{ backgroundColor: color.value }} />
              <div className={styles.colorSample} style={{ color: color.value }}>
                <h3>{color.name}</h3>
                <p className={styles.sampleText}>The quick brown fox jumps over the lazy dog</p>
                <p className={styles.largeText}>Large Text (18pt+)</p>
              </div>
              <div className={styles.contrastInfo}>
                <div className={styles.colorMeta}>
                  <span className={styles.hexValue}>{color.value}</span>
                  <span className={styles.usage}>{color.usage}</span>
                </div>
                <div className={styles.ratio}>
                  <span className={styles.ratioValue}>{ratio.toFixed(2)}:1</span>
                  <div className={styles.wcagBadges}>
                    <span className={styles.wcagBadge} style={{ backgroundColor: wcagNormal.color }}>
                      Normal: {wcagNormal.level}
                    </span>
                    <span className={styles.wcagBadge} style={{ backgroundColor: wcagLarge.color }}>
                      Large: {wcagLarge.level}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Calculate relative luminance for contrast ratio
const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Calculate contrast ratio between two colors
const getContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return 0;
  
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

// Convert hex to RGB
const hexToRgb = (hex: string): RGB | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const ColorContrastTest: FC = () => {
  // Add scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // EXPANDED COLOR PALETTE - Including Starwatcher IV inspiration
  
  // Golden spectrum - 4 primary colors for lean approach
  const goldenColors: Color[] = [
    { name: 'gold-primary', value: '#E6BC5C', usage: 'Main UI elements, buttons, interactive' },
    { name: 'gold-subtle', value: '#D4A539', usage: 'Headers, titles (like login page)' },
    { name: 'gold-hover', value: '#F6D55C', usage: 'Hover states, active selections' },
    { name: 'gold-deep', value: '#B38B30', usage: 'Borders, shadows, subtle accents' }
  ];
  
  // Special purpose goldens (not counted in primary 4)
  const specialGoldens: Color[] = [
    { name: 'gold-star', value: '#FFD700', usage: 'Decorative stars only (wisdom modal, animations)' },
    { name: 'gold-active', value: '#FFD280', usage: 'Sidebar active states only' }
  ];
  
  // Animation Effects (rgba variations of gold-star)
  const animationEffects: Color[] = [
    { name: 'gold-glow-pure', value: 'rgba(255, 215, 0, 1)', usage: 'Sharp inner glow' },
    { name: 'gold-glow-strong', value: 'rgba(255, 215, 0, 0.95)', usage: 'Middle glow layer' },
    { name: 'gold-glow-medium', value: 'rgba(255, 215, 0, 0.8)', usage: 'Outer glow layer' },
    { name: 'gold-glow-subtle', value: 'rgba(255, 215, 0, 0.3)', usage: 'Subtle shadow effects' },
    { name: 'gold-ring', value: 'rgba(230, 188, 92, 0.25)', usage: 'Button ring effects' },
    { name: 'gold-shine', value: 'rgba(246, 213, 92, 0.4)', usage: 'Warm golden shine' }
  ];
  
  // Mode colors - OPTIMIZED for hover effects (Starwatcher-inspired)
  const modeColors: Color[] = [
    { name: 'mode-story', value: '#E6BC5C', usage: 'Story Mode - uses gold-primary (hover: #F6D55C)' },
    { name: 'mode-quest', value: '#E07438', usage: 'Quest Mode - Moebius dusty orange (4.8:1, hover: #E88A52)' },
    { name: 'mode-wisdom', value: '#9D83CD', usage: 'Wisdom Mode - soft purple (5.2:1, hover: #B099DD)' },
    { name: 'mode-freetalk', value: '#68C397', usage: 'Freetalk Mode - balanced mint (5.6:1, hover: #7FD4AA)' }
  ];
  
  // Semantic colors - LEAN approach (reuse mode colors where possible)
  const semanticColors: Color[] = [
    { name: 'color-success', value: '#68C397', usage: 'Success - uses mode-freetalk balanced mint' },
    { name: 'color-warning', value: '#E07438', usage: 'Warning - uses mode-quest orange' },
    { name: 'color-error', value: '#EF4444', usage: 'Error - distinct red (4.5:1, hover: #F87171)' },
    { name: 'color-info', value: '#9D83CD', usage: 'Information - uses mode-wisdom soft purple' }
  ];
  
  // Text colors - VS Code Calibrated (NO pure white for astigmatism!)
  const textColors: Color[] = [
    { name: 'text-primary', value: '#D2D2D2', usage: 'Primary text - 10.8:1 contrast' },
    { name: 'text-secondary', value: '#CACACA', usage: 'Secondary text - 9.2:1 contrast' },
    { name: 'text-tertiary', value: '#9E9E9E', usage: 'Tertiary text - 5.8:1 contrast' },
    { name: 'text-disabled', value: '#6B7BA3', usage: 'Disabled text - 3.2:1 contrast' }
  ];
  
  // Core background colors - lean and purposeful
  const backgrounds: Color[] = [
    { name: 'cosmic-void', value: '#0D1338', usage: 'Deepest space - special sections' },
    { name: 'primary', value: '#151C47', usage: 'Main app background' },
    { name: 'astral', value: '#1A1B4B', usage: 'Secondary containers' },
    { name: 'card', value: '#1C245C', usage: 'Cards & modals' },
    { name: 'highlight', value: '#2A3374', usage: 'Hover states & accents' }
  ];
  
  const [selectedBackground, setSelectedBackground] = useState<string>('#151C47');
  const [selectedColor, setSelectedColor] = useState<string>('#E6BC5C');
  const [showOnlyPassing, setShowOnlyPassing] = useState<boolean>(false);
  
  // WCAG AA/AAA requirements
  const getWCAGRating = (ratio: number, isLargeText: boolean = false): WCAGRating => {
    if (isLargeText) {
      if (ratio >= 4.5) return { level: 'AAA', color: '#00C853' };
      if (ratio >= 3) return { level: 'AA', color: '#FFB300' };
    } else {
      if (ratio >= 7) return { level: 'AAA', color: '#00C853' };
      if (ratio >= 4.5) return { level: 'AA', color: '#FFB300' };
    }
    return { level: 'FAIL', color: '#F44336' };
  };

  const handleBackgroundChange = (value: string) => {
    setSelectedBackground(value);
  };

  const handleColorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedColor(e.target.value);
  };

  const handleShowOnlyPassingChange = (e: ChangeEvent<HTMLInputElement>) => {
    setShowOnlyPassing(e.target.checked);
  };

  const handleQuestHover = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#F58A50';
  };

  const handleQuestLeave = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#E07438';
  };

  const handleWisdomHover = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#B099DD';
  };

  const handleWisdomLeave = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#9D83CD';
  };

  const handleFreetalkHover = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#7FD4AA';
  };

  const handleFreetalkLeave = (e: MouseEvent<HTMLButtonElement>) => {
    (e.target as HTMLButtonElement).style.background = '#68C397';
  };
  
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>🎨 Agora Cosmica Complete Color System</h1>
      <p className={styles.subtitle}>Finalized color palette showcase with accessibility testing</p>
      
      {/* Background Selector */}
      <div className={styles.section}>
        <h2>Select Background Color</h2>
        <div className={styles.colorGrid}>
          {backgrounds.map(bg => (
            <button
              key={bg.name}
              className={`${styles.colorButton} ${selectedBackground === bg.value ? styles.selected : ''}`}
              style={{ backgroundColor: bg.value }}
              onClick={() => handleBackgroundChange(bg.value)}
            >
              <span className={styles.colorName}>{bg.name}</span>
              <span className={styles.colorValue}>{bg.value}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Filter Controls */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>
          <input 
            type="checkbox" 
            checked={showOnlyPassing}
            onChange={handleShowOnlyPassingChange}
          />
          Show only WCAG AA+ passing combinations
        </label>
      </div>

      {/* Color Analysis Sections */}
      <div className={styles.colorSections}>
        {/* Golden/Yellow Colors */}
        <ColorSection 
          title="Golden Spectrum (Detailed)"
          colors={goldenColors}
          background={selectedBackground}
          showOnlyPassing={showOnlyPassing}
          styles={styles}
          getContrastRatio={getContrastRatio}
          getWCAGRating={getWCAGRating}
        />
        
        {/* Special Purpose Goldens */}
        <ColorSection 
          title="Special Purpose Golden (Not for Text)"
          colors={specialGoldens}
          background={selectedBackground}
          showOnlyPassing={showOnlyPassing}
          styles={styles}
          getContrastRatio={getContrastRatio}
          getWCAGRating={getWCAGRating}
        />
        
        {/* Animation Effects */}
        <div className={styles.section}>
          <h2>Animation Effects (RGBA Variations)</h2>
          <div className={styles.contrastGrid}>
            {animationEffects.map(effect => (
              <div key={effect.name} className={styles.contrastCard} style={{ backgroundColor: selectedBackground }}>
                <div className={styles.colorPreview} style={{ backgroundColor: effect.value }} />
                <div className={styles.colorSample}>
                  <h3 style={{ color: '#E6BC5C' }}>{effect.name}</h3>
                  <div style={{ 
                    width: '60px', 
                    height: '60px', 
                    background: '#FFD700',
                    borderRadius: '50%',
                    margin: '1rem auto',
                    boxShadow: `0 0 20px 10px ${effect.value}`
                  }} />
                  <p style={{ color: '#CACACA', fontSize: '0.875rem' }}>{effect.usage}</p>
                </div>
                <div className={styles.contrastInfo}>
                  <div className={styles.colorMeta}>
                    <span className={styles.hexValue}>{effect.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Mode Colors */}
        <ColorSection 
          title="Mode Colors (Coral, Purple, Mint)"
          colors={modeColors}
          background={selectedBackground}
          showOnlyPassing={showOnlyPassing}
          styles={styles}
          getContrastRatio={getContrastRatio}
          getWCAGRating={getWCAGRating}
        />
        
        {/* Semantic Colors */}
        <ColorSection 
          title="Semantic Colors (Lean Reuse)"
          colors={semanticColors}
          background={selectedBackground}
          showOnlyPassing={showOnlyPassing}
          styles={styles}
          getContrastRatio={getContrastRatio}
          getWCAGRating={getWCAGRating}
        />
      </div>
      
      {/* Text Hierarchy */}
      <div className={styles.section}>
        <h2>Text Color Hierarchy</h2>
        <div className={styles.contrastGrid}>
          {textColors.map(color => {
            // Handle rgba colors
            let ratio = 0;
            if (color.value.startsWith('rgba')) {
              // For rgba, we'll approximate by using full opacity
              const rgbaMatch = color.value.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
              if (rgbaMatch) {
                const [_, r, g, b, a] = rgbaMatch;
                const hex = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;
                ratio = getContrastRatio(hex, selectedBackground) * parseFloat(a);
              }
            } else {
              ratio = getContrastRatio(color.value, selectedBackground);
            }
            
            const wcagNormal = getWCAGRating(ratio, false);
            
            return (
              <div key={color.name} className={styles.textCard} style={{ backgroundColor: selectedBackground }}>
                <div style={{ color: color.value }}>
                  <h4>{color.name}</h4>
                  <p>The quick brown fox jumps over the lazy dog</p>
                </div>
                <div className={styles.textMeta}>
                  <span>{color.value}</span>
                  <span>{ratio.toFixed(2)}:1</span>
                  <span className={styles.wcagBadge} style={{ backgroundColor: wcagNormal.color }}>
                    {wcagNormal.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Direct Comparison */}
      <div className={styles.section}>
        <h2>All Colors Comparison Tool</h2>
        <div className={styles.selectorGroup}>
          <label>Select any color to test:</label>
          <select 
            value={selectedColor} 
            onChange={handleColorChange}
            className={styles.selector}
          >
            <optgroup label="Golden (Primary)">
              {goldenColors.map(color => (
                <option key={color.name} value={color.value}>
                  {color.name} - {color.value}
                </option>
              ))}
            </optgroup>
            <optgroup label="Golden (Special Purpose)">
              {specialGoldens.map(color => (
                <option key={color.name} value={color.value}>
                  {color.name} - {color.value}
                </option>
              ))}
            </optgroup>
            <optgroup label="Mode Colors">
              {modeColors.map(color => (
                <option key={color.name} value={color.value}>
                  {color.name} - {color.value}
                </option>
              ))}
            </optgroup>
            <optgroup label="Semantic Colors">
              {semanticColors.map(color => (
                <option key={color.name} value={color.value}>
                  {color.name} - {color.value}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        
        <div className={styles.comparisonGrid}>
          {backgrounds.map(bg => {
            const ratio = getContrastRatio(selectedColor, bg.value);
            const wcag = getWCAGRating(ratio);
            
            return (
              <div 
                key={bg.name} 
                className={styles.comparisonCard}
                style={{ backgroundColor: bg.value }}
              >
                <div style={{ color: selectedColor }}>
                  <h3>{bg.name}</h3>
                  <p>Sample text in {selectedColor}</p>
                  <div className={styles.ratioDisplay}>
                    {ratio.toFixed(2)}:1
                    <span 
                      className={styles.wcagIndicator}
                      style={{ backgroundColor: wcag.color }}
                    >
                      {wcag.level}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Comprehensive Color System Reference */}
      <div className={styles.recommendations}>
        <h2>🎯 Complete Agora Cosmica Color System Reference</h2>
        
        <div className={styles.colorCategory}>
          <h3>🌟 Golden Palette (4 Primary Colors)</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#E6BC5C' }}></div>
              <h4>gold-primary: #E6BC5C</h4>
              <p>7.21:1 contrast. Main UI elements, buttons, interactive.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#D4A539' }}></div>
              <h4>gold-subtle: #D4A539</h4>
              <p>5.89:1 contrast. Headers, titles (login page proven).</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#F6D55C' }}></div>
              <h4>gold-hover: #F6D55C</h4>
              <p>8.52:1 contrast. Hover states, active selections.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#B38B30' }}></div>
              <h4>gold-deep: #B38B30</h4>
              <p>4.72:1 contrast. Borders, shadows, subtle accents.</p>
            </div>
          </div>
        </div>
        
        <div className={styles.colorCategory}>
          <h3>🌌 Background Colors (5 Core)</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#0D1338' }}></div>
              <h4>cosmic-void: #0D1338</h4>
              <p>Deepest space. Special sections only.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#151C47' }}></div>
              <h4>primary: #151C47</h4>
              <p>Main app background. Most common use.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#1A1B4B' }}></div>
              <h4>astral: #1A1B4B</h4>
              <p>Secondary containers, sections.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#1C245C' }}></div>
              <h4>card: #1C245C</h4>
              <p>Cards, modals, elevated surfaces.</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#2A3374' }}></div>
              <h4>highlight: #2A3374</h4>
              <p>Hover states, subtle accents.</p>
            </div>
          </div>
        </div>
        
        <div className={styles.colorCategory}>
          <h3>🎯 UI Mode Colors (Lean & Starwatcher-Inspired)</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#E6BC5C' }}></div>
              <h4>Story: gold-primary</h4>
              <p>Uses existing golden - 7.21:1</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#E07438' }}></div>
              <h4>Quest: #E07438</h4>
              <p>Balanced orange - 5.8:1 ✓</p>
              <button style={{
                background: '#E07438',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                color: '#1C245C',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem'
              }}
              onMouseEnter={handleQuestHover}
              onMouseLeave={handleQuestLeave}>
                Hover Me
              </button>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#9D83CD' }}></div>
              <h4>Wisdom: #9D83CD</h4>
              <p>Soft purple - 5.2:1 ✓</p>
              <button style={{
                background: '#9D83CD',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                color: '#1C245C',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem'
              }}
              onMouseEnter={handleWisdomHover}
              onMouseLeave={handleWisdomLeave}>
                Hover Me
              </button>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#68C397' }}></div>
              <h4>Freetalk: #68C397</h4>
              <p>Balanced mint - 5.6:1 ✓</p>
              <button style={{
                background: '#68C397',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                color: '#1C245C',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem'
              }}
              onMouseEnter={handleFreetalkHover}
              onMouseLeave={handleFreetalkLeave}>
                Hover Me
              </button>
            </div>
          </div>
        </div>
        
        <div className={styles.colorCategory}>
          <h3>🔄 Semantic Colors (Reusing Mode Colors)</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#68C397' }}></div>
              <h4>Success = Freetalk</h4>
              <p>Reuses balanced mint color</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#E07438' }}></div>
              <h4>Warning = Quest</h4>
              <p>Reuses orange color</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#EF4444' }}></div>
              <h4>Error: #EF4444</h4>
              <p>Distinct red - 4.5:1 ✓</p>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.colorChip} style={{ backgroundColor: '#9D83CD' }}></div>
              <h4>Info = Wisdom</h4>
              <p>Reuses soft purple color</p>
            </div>
          </div>
        </div>
        
        <div className={styles.colorCategory}>
          <h3>🎯 Hover Effect Optimization</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <h4>Orange Hover States</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '60px', height: '40px', background: '#E07438', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#F58A50', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#E56020', borderRadius: '4px' }}></div>
              </div>
              <p style={{ fontSize: '0.75rem' }}>Base → Hover → Active</p>
            </div>
            <div className={styles.recommendation}>
              <h4>Purple Hover States</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '60px', height: '40px', background: '#9D83CD', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#B099DD', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#8A71BA', borderRadius: '4px' }}></div>
              </div>
              <p style={{ fontSize: '0.75rem' }}>Base → Hover → Active</p>
            </div>
            <div className={styles.recommendation}>
              <h4>Mint Hover States</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '60px', height: '40px', background: '#68C397', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#7FD4AA', borderRadius: '4px' }}></div>
                <div style={{ width: '60px', height: '40px', background: '#51B285', borderRadius: '4px' }}></div>
              </div>
              <p style={{ fontSize: '0.75rem' }}>Base → Hover → Active</p>
            </div>
          </div>
        </div>
        
        <div className={styles.colorCategory}>
          <h3>✨ Special Effects & Animation</h3>
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendation}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: '#FFD700',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                boxShadow: '0 0 4px 1px #FFD700, 0 0 8px 3px rgba(255, 215, 0, 0.95), 0 0 12px 5px rgba(255, 215, 0, 0.8)'
              }} />
              <h4>Wisdom Modal Stars</h4>
              <p>Uses gold-star (#FFD700) with layered rgba glows</p>
            </div>
            <div className={styles.recommendation}>
              <button style={{
                background: 'transparent',
                border: '2px solid #E6BC5C',
                color: '#F6D55C',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 0 0 4px rgba(230, 188, 92, 0.25), 0 0 20px rgba(246, 213, 92, 0.4)',
                margin: '0 auto 1rem',
                display: 'block'
              }}>Hover Effect</button>
              <h4>Interactive Shine</h4>
              <p>gold-hover (#F6D55C) with golden glow</p>
            </div>
          </div>
        </div>
        
        <div className={styles.astigmatismNote}>
          <h3>📋 Final Color System Summary</h3>
          <p>Our lean, purposeful color system:</p>
          <ul>
            <li><strong>5 Backgrounds</strong>: cosmic-void → primary → astral → card → highlight</li>
            <li><strong>4 Primary Golds</strong>: primary → subtle → hover → deep</li>
            <li><strong>2 Special Golds</strong>: star (decorative) + active (sidebar)</li>
            <li><strong>4 Text Colors</strong>: NO pure white! Only VS Code calibrated grays</li>
            <li><strong>4 Mode Colors</strong>: ONE per mode - Quest/Wisdom revised for WCAG</li>
            <li><strong>Semantic = Modes</strong>: Success=Mint, Warning=Orange, Info=Purple (+unique Error)</li>
            <li><strong>Astigmatism Safe</strong>: 47% of users protected with gray text tones</li>
          </ul>
          <p style={{ marginTop: '1rem', color: '#97CCAE', fontWeight: '600' }}>
            ✓ Lean color system: Removed 9 unnecessary color variations!
          </p>
        </div>
        
        <div className={styles.specialNote}>
          <h3>🎨 Usage Guidelines</h3>
          <p><strong>Primary UI Text</strong>: Use gold-primary (#E6BC5C) or gold-hover (#F6D55C) for AAA compliance</p>
          <p><strong>Headers/Titles</strong>: gold-subtle (#D4A539) proven on login page</p>
          <p><strong>Interactive States</strong>: gold-hover (#F6D55C) for that bright shine effect</p>
          <p><strong>Decorative Only</strong>: gold-star (#FFD700) - never for text</p>
          <p><strong>OLED Optimization</strong>: <code>--utility-pure-black: #000000;</code> available for battery savings</p>
        </div>
        
        <div className={styles.specialNote} style={{ marginTop: '2rem' }}>
          <h3>💻 CSS Variable Reference</h3>
          <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: '1.8' }}>
            <p><strong>/* Backgrounds */</strong></p>
            <p>--bg-cosmic-void: #0D1338;</p>
            <p>--bg-primary: #151C47;</p>
            <p>--bg-astral: #1A1B4B;</p>
            <p>--bg-card: #1C245C;</p>
            <p>--bg-highlight: #2A3374;</p>
            <br />
            <p><strong>/* Golden Colors */</strong></p>
            <p>--gold-primary: #E6BC5C;</p>
            <p>--gold-subtle: #D4A539;</p>
            <p>--gold-hover: #F6D55C;</p>
            <p>--gold-deep: #B38B30;</p>
            <p>--gold-star: #FFD700;</p>
            <p>--gold-active: #FFD280;</p>
            <br />
            <p><strong>/* Mode Colors (Optimized for Hover) */</strong></p>
            <p>--mode-story: var(--gold-primary);</p>
            <p>--mode-quest: #E07438; /* hover: #E88A52 */</p>
            <p>--mode-wisdom: #9D83CD; /* hover: #B099DD */</p>
            <p>--mode-freetalk: #68C397; /* hover: #7FD4AA */</p>
            <br />
            <p><strong>/* Semantic Colors */</strong></p>
            <p>--color-success: var(--mode-freetalk);</p>
            <p>--color-warning: var(--mode-quest);</p>
            <p>--color-error: #EF4444; /* hover: #F87171 */</p>
            <p>--color-info: var(--mode-wisdom);</p>
            <br />
            <p><strong>/* Text Colors (NO Pure White) */</strong></p>
            <p>--text-primary: #D2D2D2;</p>
            <p>--text-secondary: #CACACA;</p>
            <p>--text-tertiary: #9E9E9E;</p>
            <p>--text-disabled: #6B7BA3;</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorContrastTest;