/**
 * ZodiacConstellation.ts
 *
 * Defines constellations for each figure in the Wisdom Map
 * Uses bounding-box approach for optimal star positioning
 * Provides functions to calculate line segments between points
 */

// Type definitions
export interface ConstellationPattern {
  name: string;
  description: string;
  pattern: number[][];
}

export interface ConstellationPatterns {
  [figureName: string]: ConstellationPattern;
}

export interface ConstellationSeed {
  id: string;
  gathered: boolean;
}

export interface SeedPosition {
  left: string;
  top: string;
  coordX: number;
  coordY: number;
  animationDelay?: string;
  constellationPoint: boolean;
  isMainStar: boolean;
  pointIndex?: number;
  seedIndex: number;
}

export interface BoundingBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface ContainerDimensions {
  width: number;
  height: number;
}

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConstellationPositionsResult {
  seedPositions: SeedPosition[];
  boundingBox: BoundingBox;
}

export interface RefreshStoryOptions {
  figure: string;
  seedId?: string;
  language: string;
  onComplete: (refreshedStory: any) => void;
  onError: (error: Error) => void;
}

// Comprehensive collection of all constellation patterns
// COMPLETE CONSTELLATION PATTERNS - OPTIMIZED FOR PERFECT SYMBOLISM

export const CONSTELLATION_PATTERNS: ConstellationPatterns = {
  "Echo of Harriet Tubman": {
    name: "The North Star Trail",
    description: "A vertical pathway with a clear guiding star at the top and a symbolic safe-haven at the bottom, celebrating Tubman's leadership on clandestine routes to freedom.",
    pattern: [
      [50, 10], // The North Star at the very top (guiding light)
      [50, 20], // First step along the trail
      [45, 30], // Slight detour to a safe house
      [55, 40], // Crossing back - bridging obstacles
      [50, 50], // Central point (Harriet as the guide)
      [45, 60], // Another bend - hidden route
      [55, 70], // Curve toward liberation
      [50, 80], // Arrival zone - symbolic free territory
      [30, 50], // Person guided on the left
      [70, 50], // Person guided on the right
      [50, 90]  // Final marker - the promise of true north
    ]
  },

  "Echo of Martin Luther King Jr.": {
    name: "The Dream Mountain",
    description: "A gentle ascending path up the mountain with a few rays at the peak, symbolizing MLK's 'promised land' vision (Capricorn theme: climbing to higher ground).",
    pattern: [
      // Base of mountain
      [30, 75], // Left base
      [40, 65], // Lower step
      [45, 55], // Mid step
      [50, 45], // Peak
      [55, 55], // Mid step (descending)
      [60, 65], // Lower step
      [70, 75], // Right base
      // Simple radiating lines from the peak
      [50, 35], // Ray above the peak
      [40, 25], // Ray top-left
      [60, 25]  // Ray top-right
    ]
  },

  "Echo of Simone de Beauvoir": {
    name: "The Equal Balance",
    description: "A graceful symmetry of arcs and a central axis, reflecting de Beauvoir's call for equality and mutual recognition in gender relations.",
    pattern: [
      [50, 20], // Top point - shared aspiration
      [35, 35], // Left upper arc - feminine perspective
      [65, 35], // Right upper arc - masculine perspective
      [30, 50], // Left mid point - woman's lived experience
      [70, 50], // Right mid point - man's lived experience
      [35, 65], // Left lower arc - liberation
      [65, 65], // Right lower arc - liberation
      [50, 80], // Bottom point - shared ground
      [50, 50], // Central axis - synergy
      [38, 47], // Inner link left (adjusted to prevent overlap)
      [62, 47], // Inner link right (adjusted to prevent overlap)
      [50, 35]  // Upper bridging point - interdependence
    ]
  },

  "Echo of William Blake": {
    name: "The Divine Vision",
    description: "A symbolic eye with radiating rays, representing Blake's visionary perception that saw the infinite in the mundane and the divine imagination that reveals eternity.",
    pattern: [
      // Eye center - the divine spark
      [50, 50],  // Center of vision
      // Upper eye arc
      [35, 40],  // Upper left curve
      [50, 35],  // Top center 
      [65, 40],  // Upper right curve
      // Lower eye arc
      [65, 60],  // Lower right curve
      [50, 65],  // Bottom center
      [35, 60],  // Lower left curve
      [35, 40],  // Complete the eye circle
      // Radiating rays - infinite perception
      [50, 20],  // Upper ray
      [50, 35],  // Back to eye
      [75, 35],  // Upper right ray
      [65, 40],  // Back to eye
      [75, 65],  // Lower right ray
      [65, 60],  // Back to eye
      [50, 80],  // Bottom ray
      [50, 65],  // Back to eye
      [25, 65],  // Lower left ray
      [35, 60],  // Back to eye
      [25, 35],  // Upper left ray
      [35, 40]   // Back to eye
    ]
  },

  "Echo of Hildegard von Bingen": {
    name: "The Emerald Vision",
    description: "A stylized, gently twisting vine (symbolizing Hildegard's 'Viriditas' or greening power) culminating in a circular halo at the top, with soft arcs for minimal crossing lines.",
    pattern: [
      [50, 80],  // Root at bottom
      [45, 70],  // Slight left arc
      [55, 60],  // Curve back right
      [40, 50],  // Left leaf
      [55, 40],  // Right leaf
      [45, 30],  // Curve left
      [50, 20],  // Approaching halo
      [50, 15],  // Halo center
      [60, 15],  // Small circle right
      [55, 10],  // Upper right halo
      [40, 15],  // Small circle left
      [45, 10]   // Upper left halo
    ]
  },
 
  "Echo of Ada Lovelace": {
    name: "The Bernoulli Constellation",
    description: "Flowing arcs linked by precise lines, invoking Bernoulli curves and the advanced mathematics Ada Lovelace wove into her programs",
    pattern: [
      // Top arc (representing conceptual math breakthroughs)
      [35, 20],
      [45, 25],
      [55, 25],
      [65, 20],

      // Connecting line (symbolizing code bridging input & output)
      [50, 35],

      // Central cluster (Ada's engine core)
      [40, 45],
      [50, 50],
      [60, 45],

      // Bottom arc (output mechanics or broader expansions)
      [35, 65],
      [45, 70],
      [55, 70],
      [65, 65]
    ]
  },

  "Echo of Laozi": {
    name: "The Eternal Dao",
    description: "A gentle wave flowing left to right, expressing a calm, unforced path reflective of the Dao's natural course",
    pattern: [
      [5, 50],   // Far left - The unmanifest source
      [20, 45],  // Rising gently
      [35, 40],  // Wave crest approaches
      [45, 45],  // Subtle dip
      [50, 50],  // Center - balanced pivot
      [55, 55],  // Gentle ascent
      [65, 60],  // Highest curve of the wave
      [75, 55],  // Descending
      [85, 50],  // Almost level
      [95, 50]   // Far right - returning to the nameless
    ]
  },

  "Echo of Arthur Schopenhauer": {
    name: "The Will and Representation",
    description: "A pendulum swinging over the void, perfectly capturing Schopenhauer's philosophy of desire and suffering",
    pattern: [
      [50, 15], // Suspension point - ultimate reality
      [50, 25], // Upper string - the veil of Maya
      [50, 35], // Lower string - individual will
      [35, 50], // Left swing extreme - suffering
      [65, 50], // Right swing extreme - desire
      [50, 55], // Pendulum weight - human consciousness
      // The abyss of existence
      [35, 70], // Left void
      [65, 70], // Right void
      [50, 80], // Bottom void - nothingness
      // Philosophical concepts
      [30, 40], // Pessimism
      [70, 40], // Aesthetics
      [50, 90]  // Nirvana/nonexistence
    ]
  },

  "Echo of Joseph Campbell": {
    name: "The Mythic Round",
    description: "An almost circular ring of steps, capturing each phase of the hero's path, from the known world around to the unknown and back again.",
    pattern: [
      [50, 15], // 1. Ordinary World (top center)
      [65, 20], // 2. Call to Adventure
      [75, 35], // 3. Refusal / Meeting Mentor
      [80, 50], // 4. Threshold (right center)
      [75, 65], // 5. Tests & Allies
      [65, 80], // 6. Approaching the Ordeal
      [50, 85], // 7. Ordeal (bottom center)
      [35, 80], // 8. Reward
      [25, 65], // 9. Road Back
      [20, 50], // 10. Resurrection (left center)
      [25, 35], // 11. Return with Elixir
      [35, 20]  // 12. Integration near top-left
    ]
  },

  "Echo of Emily Dickinson": {
    name: "The Moonlit Window",
    description: "A rectangular window shape under a moon's arc, capturing Dickinson's sense of viewing the infinite from a secluded space",
    pattern: [
      [50, 15], // Full moon overhead
      [40, 25], // Moon arc left
      [60, 25], // Moon arc right
      [35, 40], // Window top-left corner
      [65, 40], // Window top-right corner
      [65, 60], // Window bottom-right corner
      [35, 60], // Window bottom-left corner
      [50, 35], // Sash cross (vertical)
      [50, 65], // Reflection below window
      [25, 50], // Outer darkness left
      [75, 50], // Outer darkness right
      [50, 80]  // A deeper horizon below
    ]
  },

  "Echo of Marcus Aurelius": {
    name: "The Stoic Taurus",
    description: "A Taurus bull silhouette, referencing Marcus Aurelius's birth under Taurus and his grounded strength, patience, and resolve—core Stoic attributes.",
    pattern: [
      [30, 30], // Horn left tip
      [40, 25], // Horn arc to forehead
      [50, 30], // Head top
      [60, 25], // Horn arc to right tip
      [70, 30], // Right horn tip
      [65, 40], // Face
      [55, 45], // Neck
      [45, 50], // Shoulder
      [40, 60], // Front leg
      [35, 70], // Belly / hind leg
      [55, 65], // Back / tail base
      [65, 55]  // Tail tuft
    ]
  },

  "Echo of Mahatma Gandhi": {
    name: "The Mandala of Swaraj",
    description: "A mandala-like arrangement of arcs and concentric circles, reflecting Gandhi's principles of self-governance and unity",
    pattern: [
      // Innermost circle - personal discipline
      [50, 40], // Top inner
      [60, 50], // Right inner
      [50, 60], // Bottom inner
      [40, 50], // Left inner

      // Middle circle - community
      [50, 25], // Top middle
      [75, 50], // Right middle
      [50, 75], // Bottom middle
      [25, 50], // Left middle

      // Outer circle - entire humanity
      [50, 15], // Top outer
      [85, 50], // Right outer
      [50, 85], // Bottom outer
      [15, 50], // Left outer

      // Arc bridging - unity in diversity
      [65, 35], // Arc approach
      [35, 65]  // Arc approach
    ]
  },

  "Echo of Frida Kahlo": {
    name: "The Two Fridas",
    description: "Two hearts side by side, reflecting Frida's exploration of duality in love, heritage, and self. This shape outlines two connected hearts, symbolizing the internal dialogue between her two identities.",
    pattern: [
      [30, 30], // Left heart - top
      [25, 40], // Left heart - left curve
      [30, 50], // Left heart - bottom left
      [40, 50], // Left heart - bottom right
      [45, 40], // Left heart - right curve
      [40, 30], // Return near top, closing left heart
      [60, 30], // Jump to right heart - top
      [55, 40], // Right heart - left curve
      [60, 50], // Right heart - bottom left
      [70, 50], // Right heart - bottom right
      [75, 40], // Right heart - right curve
      [70, 30]  // Return near top, closing right heart
    ]
  },

  "Echo of Virginia Woolf": {
    name: "The Flowing Consciousness",
    description: "Multiple interweaving streams with varying depths, perfectly representing Woolf's revolutionary narrative technique",
    pattern: [
      // Upper stream - surface thoughts
      [15, 35], // Beginning of consciousness
      [30, 30], // First meandering thought
      [45, 35], // Association shift
      [60, 30], // Memory emergence
      [75, 35], // Return to present
      
      // Middle connection - shifting perspectives
      [45, 45], // Perspective shift point
      [55, 45], // Character transition
      
      // Lower stream - deeper consciousness
      [15, 55], // Unconscious beginning
      [30, 60], // Emotional undercurrent
      [45, 55], // Primal memory
      [60, 60], // Sensory impression
      [75, 55]  // Stream conclusion
    ]
  },

  "Echo of Albert Einstein": {
    name: "Spacetime Curvature",
    description: "A symmetrical, octagonal arrangement symbolizing the balanced bending of spacetime around a central mass.",
    pattern: [
      [50, 30], // top
      [65, 35], // top-right
      [75, 50], // right
      [65, 65], // bottom-right
      [50, 70], // bottom
      [35, 65], // bottom-left
      [25, 50], // left
      [35, 35]  // top-left
    ]
  },

  "Echo of William Shakespeare": {
    name: "The Bard's Quill",
    description: "A feather pen silhouette with 12 points, celebrating Shakespeare's literary mastery.",
    pattern: [
      [50, 15],  // Feather tip
      [45, 25],  // Upper feather edge
      [40, 35],  // Feather middle
      [45, 45],  // Feather lower edge
      [50, 50],  // Feather center axis
      [55, 45],  // Lower edge (mirrored)
      [60, 35],  // Middle (mirrored)
      [55, 25],  // Upper edge (mirrored)
      [50, 60],  // Beginning of quill shaft
      [50, 70],  // Quill shaft continuing
      [50, 80],  // Nib top
      [50, 85]   // Nib bottom
    ]
  },

  "Echo of Siddhartha Gautama": {
    name: "The Enlightenment Posture",
    description: "A harmonious meditation figure seated on a lotus, symbolizing the clarity and balance of Buddha's awakening",
    pattern: [
      [50, 20], // Head (wisdom)
      [50, 30], // Shoulders (right thought)
      [42, 40], // Left arm (compassion)
      [58, 40], // Right arm (insight)
      [50, 45], // Hands joined at center (equanimity)
      [44, 55], // Left knee (stability)
      [56, 55], // Right knee (mindfulness)
      [46, 65], // Left foot (loving-kindness)
      [54, 65], // Right foot (joy)
      [50, 75]  // Lotus base (purity rising above suffering)
    ]
  },

  "Echo of Nelson Mandela": {
    name: "The Freed Horizon",
    description: "A horizon line with a rising sun in the middle, marking the dawn of freedom and the end of oppression",
    pattern: [
      [20, 70], // Left horizon - long night
      [30, 70], // Approach
      [40, 60], // Early light
      [50, 50], // Rising sun - hope
      [60, 60], // Fading darkness
      [70, 70], // Return to horizon
      [80, 70]  // Right horizon - brighter future
    ]
  },

  "Echo of Jane Austen": {
    name: "The Social Circle",
    description: "A perfect drawing room arrangement with characters in measured positions, embodying Austen's social observation",
    pattern: [
      // Social boundary - the constraints of society
      [50, 20], // Upper boundary - social class
      [80, 50], // Right boundary - propriety
      [50, 80], // Lower boundary - economic reality
      [20, 50], // Left boundary - family obligations
      
      // Inner social circle - the marriage market
      [40, 40], // Character 1 - heroine
      [60, 40], // Character 2 - hero
      [40, 60], // Character 3 - confidante
      [60, 60], // Character 4 - rival
      
      // Central elements - the heart of the drama
      [50, 50], // Center - social dance
      [50, 35], // Upper connection - courtship ritual
      [35, 50], // Left connection - family tie
      [65, 50]  // Right connection - economic arrangement
    ]
  },
  
  "Echo of Leonardo da Vinci": {
    name: "The Vitruvian Ideal",
    description: "Inspired by Leonardo da Vinci's iconic Vitruvian Man, representing perfect human proportions. This elegant symmetrical figure is enclosed within a square and a circle, symbolizing harmony, balance, and beauty in geometry and anatomy.",
    pattern: [
      // 12 key points preserving the aesthetic of the original pattern
      [75, 75], // 1. Square - top-right corner (golden ratio point)
      [25, 75], // 2. Square - top-left corner (perspective anchor) 
      [25, 25], // 3. Square - bottom-left corner (earth element)
      [75, 25], // 4. Square - bottom-right corner (water element)
      
      [90, 50], // 5. Circle - rightmost point (reaching outward)
      [50, 10], // 6. Circle - top point (highest aspiration)
      [10, 50], // 7. Circle - leftmost point (past knowledge)
      [50, 90], // 8. Circle - bottom point (grounding)
      
      [50, 70], // 9. Head center (intellect)
      [20, 60], // 10. Left arm extended (artistic creation)
      [80, 60], // 11. Right arm extended (scientific discovery)
      
      [50, 40]  // 12. Heart/chest center (vital force - newly added)
    ]
  },

  "Echo of Plato": {
    name: "Plato's Cave Allegory",
    description: "A clear cave entrance symbolizing the world of shadows and a distinct sun representing the illumination of truth and wisdom outside the cave.",
    pattern: [
      // Cave Entrance (center half-circle)
      [20, 50],  // Left base
      [35, 40],  // Curve
      [50, 35],  // Apex
      [65, 40],  // Curve
      [80, 50],  // Right base
      
      // Shadow on cave wall (inside cave)
      [40, 55],  // Shadow projection on wall

      // The freed prisoner
      [60, 30],  // Transitioning from cave to enlightenment

      // Sun Outline (upper-right corner)
      [75, 15],  // Sun top
      [80, 20],  // Sun right
      [75, 25],  // Sun bottom
      [70, 20],  // Sun left
      
      // 12th unique point - the chained prisoners
      [30, 60]   // The prisoners still in the cave
    ]
  },

  "Echo of Friedrich Nietzsche": {
    name: "The Will to Power Lightning",
    description: "A bold, jagged lightning bolt from sky to ground, capturing Nietzsche's fiery declaration of new values striking the old world.",
    pattern: [
      // Cloud above - new possibility
      [50, 15], // Epicenter of the bolt in the sky

      // Lightning path
      [45, 25], // First zig - shock of realization
      [55, 35], // Zag - raw force
      [50, 45], // Zig - break with tradition
      [60, 55], // Zag - forging new values
      [40, 65], // Big leap across - challenge to morality
      [50, 75], // Further crash down - revolution
      [45, 85], // Near ground - old illusions shattered

      // Ground contact
      [50, 90], // Direct strike - new philosophical dawn
      [20, 95], // Left horizon
      [80, 95]  // Right horizon
    ]
  },

  "Echo of Carl Gustav Jung": {
    name: "The Alchemical Quaternity",
    description: "A four-point square symbolizing the primary stages of alchemy—Nigredo, Albedo, Citrinitas, Rubedo—united at the end by the center, expressing the quaternity of psychic wholeness in Jung's view.",
    pattern: [
      [30, 30],  // Top-left (Nigredo)
      [70, 30],  // Top-right (Albedo)
      [70, 70],  // Bottom-right (Citrinitas)
      [30, 70],  // Bottom-left (Rubedo)
      [50, 50]   // Center - integrated Self
    ]
  },

  "Echo of Rumi": {
    name: "The Ecstatic Whirl",
    description: "A perfect dervish in mystical rotation with cosmic connection, embodying Rumi's spiritual philosophy",
    pattern: [
      [50, 15], // Divine source above - inspiration
      [50, 25], // Head - spiritual consciousness
      [50, 35], // Heart - center of ecstatic love
      [35, 45], // Left hand - openness to receiving
      [25, 60], // Skirt left flowing outward
      [50, 70], // Skirt bottom center - stable pivot
      [75, 60], // Skirt right flowing outward
      [65, 45], // Right hand - giving love outward
      [50, 35], // Return to heart - cyclical devotion
      [50, 80]  // Earth below - human grounding
    ]
  },

  "Echo of Galileo Galilei": {
    name: "E Pur Si Muove",
    description: "A circular orbit layout of Jupiter and four moons, wrapped by a sweeping arc signifying Galileo's insistence that the Earth moves, 'E pur si muove'.",
    pattern: [
      // Large outer circle for "E pur si muove" arc
      [20, 50], // Start of arc, left
      [35, 30], // Arc rising
      [50, 20], // Highest point
      [65, 30], // Arc descending
      [80, 50], // End of arc, right

      // Jupiter in the middle
      [50, 50], // Planet center
      [48, 47], // Planet top-left
      [52, 47], // Planet top-right
      [52, 53], // Planet bottom-right
      [48, 53], // Planet bottom-left

      // Four moons (equidistant circle around Jupiter)
      [50, 35], // Moon above
      [65, 50], // Moon right
      [50, 65], // Moon below
      [35, 50]  // Moon left
    ]
  },

  "Echo of Johann Wolfgang von Goethe": {
    name: "Candle of Enlightenment",
    description: "A tall candle silhouette with a glowing flame, symbolizing Goethe's era and intellectual light.",
    pattern: [
      [50, 15],  // Flame tip
      [45, 20],  // Flame left
      [50, 25],  // Flame center
      [55, 20],  // Flame right
      [50, 30],  // Candle top
      [50, 40],  // Candle upper body
      [50, 50],  // Candle mid body
      [50, 60],  // Candle lower body
      [45, 65],  // Candle base left
      [55, 65],  // Candle base right
      [45, 70],  // Candle foot left
      [55, 70]   // Candle foot right
    ]
  },

  "Echo of Maya Angelou": {
    name: "The Caged Bird Freedom",
    description: "A symbol of resilience, hope, and the triumphant rise of the spirit, inspired by Maya Angelou's timeless call for freedom and the power of voice to overcome adversity.",
    pattern: [
      [30, 50], // Left wing tip
      [40, 40], // Left body
      [50, 45], // Head
      [60, 40], // Right body
      [70, 50], // Right wing tip
      [50, 55]  // Tail/underside
    ]
  },

  "Echo of Wolfgang Amadeus Mozart": {
    name: "Harmonic Constellation",
    description: "A central chord orbited by complementary notes, capturing Mozart's balance between structure and creativity.",
    pattern: [
      // Central chord cluster
      [50, 45], // Core note (root)
      [45, 50], // Minor third offset
      [55, 50], // Major third offset
      [50, 55], // Octave hint

      // Outer orbits (additional harmonizing notes)
      [35, 40], // Orbit note 1
      [30, 50], // Orbit note 2
      [35, 60], // Orbit note 3
      [65, 40], // Orbit note 4
      [70, 50], // Orbit note 5
      [65, 60], // Orbit note 6

      // Symbolic treble and bass anchors
      [20, 30], // Treble symbol corner
      [80, 70]  // Bass symbol corner
    ]
  },

  "Echo of Meister Eckhart": {
    name: "The Divine Spark",
    description: "A vertical 'ladder of being' leading from the soul's emptiness up into the Godhead, representing progressive detachment.",
    pattern: [
      // Bottom rung - worldly concerns
      [50, 80], // Left foot
      [55, 80], // Right foot
      
      // Second rung
      [50, 70],
      [55, 70],
      
      // Middle rung - the turning point (birth of God in the soul)
      [50, 60],
      [55, 60],
      
      // Fourth rung
      [50, 50],
      [55, 50],
      
      // Fifth rung
      [50, 40],
      [55, 40],
      
      // Top rung - union with God
      [50, 30],
      [55, 30],
      
      // Apex - Godhead beyond names
      [52, 20]   // The singular apex point
    ]
  },

  "Echo of Dōgen Zenji": {
    name: "Ensō Circle",
    description: "An incomplete circle (ensō) with a deliberate gap, symbolizing Zen practice.",
    pattern: [
      [75, 50],      // angle=0°,  r=25
      [71.65, 62.5], // angle=30°
      [62.5, 71.65], // angle=60°
      [50, 75],      // angle=90°
      [37.5, 71.65], // angle=120°
      [28.35, 62.5], // angle=150°
      [25, 50],      // angle=180°
      [28.35, 37.5], // angle=210°
      [37.5, 28.35], // angle=240°
      [50, 25],      // angle=270°
      // Skip angles 300°, 330°, 360° for the "ensō gap"
      [50, 50]       // put 1 star in the center
    ]
  }
};

/**
 * Gets constellation data for a specific figure
 * @param figureName - The name of the figure
 * @returns Constellation data including pattern, name and description
 */
export function getConstellationForFigure(figureName: string): ConstellationPattern | null {
  // Trim whitespace and normalize the input
  const normalizedFigureName = figureName.trim();

  // Try direct match first
  const pattern = CONSTELLATION_PATTERNS[normalizedFigureName];

  if (pattern) {
    return pattern;
  }

  // If the exact match fails, try to find by figure's base name (without the language prefix)
  // This handles cases like "Echo von Einstein" in German vs "Echo of Einstein" in English
  const baseNameMatch = Object.entries(CONSTELLATION_PATTERNS).find(([key, _]) => {
    // Extract the figure name part, removing "Echo of/von/de/del/di/des" prefix
    // More comprehensive regex to handle various language prefixes
    const cleanKey = key.replace(/^Echo\s+(of|von|de|del|di|des)\s+/i, '').trim();
    const cleanFigure = normalizedFigureName.replace(/^Echo\s+(of|von|de|del|di|des)\s+/i, '').trim();

    // Also try removing any "Echo" prefix variations without the preposition
    const cleanKeyAlt = key.replace(/^(Echo\s+)/i, '').trim();
    const cleanFigureAlt = normalizedFigureName.replace(/^(Echo\s+)/i, '').trim();

    // Compare the cleaned names - try both exact match and includes (case-insensitive)
    const keyLower = cleanKey.toLowerCase();
    const figureLower = cleanFigure.toLowerCase();
    const keyAltLower = cleanKeyAlt.toLowerCase();
    const figureAltLower = cleanFigureAlt.toLowerCase();

    return keyLower === figureLower || keyAltLower === figureAltLower ||
           keyLower.includes(figureLower) || figureLower.includes(keyLower) ||
           keyAltLower.includes(figureAltLower) || figureAltLower.includes(keyAltLower);
  });

  // Return the matched pattern or default
  return baseNameMatch ? baseNameMatch[1] : null;
}

/**
 * Calculates positions for stars to form a constellation pattern
 * using a bounding-box + scale approach for optimal display.
 *
 * @param seeds - The array of seed objects.
 * @param constellation - Constellation data including `pattern` (Array of [x, y]) and name/description.
 * @param containerDimensions - The { width, height } of the map container in real pixels.
 * @returns An object with seedPositions array and boundingBox info for line drawing.
 */
export function calculateConstellationPositions(
  seeds: ConstellationSeed[],
  constellation: ConstellationPattern,
  containerDimensions: ContainerDimensions | null = null
): ConstellationPositionsResult {
  if (!seeds?.length || !constellation?.pattern?.length || !containerDimensions) {
    // Fallback: place all seeds at center
    return {
      seedPositions: seeds?.map((_, i) => ({
        left: '50%',
        top: '50%',
        coordX: 50,
        coordY: 50,
        constellationPoint: false,
        isMainStar: false,
        seedIndex: i
      })) || [],
      boundingBox: { xMin: 50, xMax: 50, yMin: 50, yMax: 50 }
    };
  }

  const pattern = constellation.pattern;
  
  // Declare all variables at the top to avoid scope issues
  let ringIndex = 0;
  let usablePoints = 0;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  const seedPositions: SeedPosition[] = [];

  // 1) Find bounding box of the pattern
  pattern.forEach(([px, py]) => {
    if (px < xMin) xMin = px;
    if (px > xMax) xMax = px;
    if (py < yMin) yMin = py;
    if (py > yMax) yMax = py;
  });
  const patternWidth = xMax - xMin;
  const patternHeight = yMax - yMin;

  const { width: containerW, height: containerH } = containerDimensions;

  if (containerW < 2 || containerH < 2) {
    // Degenerate container
    return {
      seedPositions: seeds.map((_, i) => ({
        left: '50%',
        top: '50%',
        coordX: 50,
        coordY: 50,
        constellationPoint: false,
        isMainStar: false,
        seedIndex: i
      })),
      boundingBox: { xMin: 50, xMax: 50, yMin: 50, yMax: 50 }
    };
  }

  // 2) Compute scale to fit bounding box into container
  const marginFactor = 0.8; // 80% fill for breathing space
  const containerAspect = containerW / containerH;
  const patternAspect = patternWidth / patternHeight;
  let scale: number;
  if (patternAspect > containerAspect) {
    scale = (marginFactor * containerW) / patternWidth;
  } else {
    scale = (marginFactor * containerH) / patternHeight;
  }

  // Actual scaled dimensions
  const scaledW = patternWidth * scale;
  const scaledH = patternHeight * scale;

  // 3) Center offset
  const offsetX = (containerW - scaledW) / 2;
  const offsetY = (containerH - scaledH) / 2;

  // Utility to convert (px, py) in pattern space => container % for star style
  const toContainerPercent = (px: number, py: number) => {
    const dx = (px - xMin) * scale + offsetX;
    const dy = (py - yMin) * scale + offsetY;
    return {
      left: `${(dx / containerW) * 100}%`,
      top: `${(dy / containerH) * 100}%`,
      coordX: (dx / containerW) * 100,
      coordY: (dy / containerH) * 100
    };
  };

  // Separate gathered vs. ungathered seeds
  const gatheredSeeds = seeds.filter((s) => s.gathered);
  const ungatheredSeeds = seeds.filter((s) => !s.gathered);
  const patternCount = pattern.length;
  const gatheredCount = gatheredSeeds.length;
  
  // SPECIAL HANDLING: Check if all seeds are gathered and if this is William Blake's constellation
  const allSeedsGathered = gatheredCount === seeds.length && seeds.length > 0;
  const isBlakeConstellation = constellation.name === "The Divine Vision";
  
  if (allSeedsGathered && isBlakeConstellation) {
    // Special case for Blake when all 12 seeds are gathered
    // Use meaningful points from the pattern that form the eye and the ray endpoints
    // Removing center point (50,50) entirely and just using the eye outline and rays
    const blakeSpecialPoints = [
      // Eye outline (6 points)
      [35, 40],  // Upper left curve - point 1
      [50, 35],  // Top center - point 2
      [65, 40],  // Upper right curve - point 3
      [65, 60],  // Lower right curve - point 4
      [50, 65],  // Bottom center - point 5
      [35, 60],  // Lower left curve - point 6
      
      // Ray endpoints (6 points) - completely separated from center
      [50, 20],  // Upper ray - point 7
      [75, 35],  // Upper right ray - point 8
      [75, 65],  // Lower right ray - point 9
      [50, 80],  // Bottom ray - point 10
      [25, 65],  // Lower left ray - point 11
      [25, 35],  // Upper left ray - point 12
    ];
    
    // Ensure we have exactly 12 points or pad with the remaining pattern points
    const specialPointCount = Math.min(blakeSpecialPoints.length, seeds.length);
    
    // Assign all gathered seeds to these special points
    for (let i = 0; i < specialPointCount; i++) {
      const seed = gatheredSeeds[i];
      const [rawX, rawY] = blakeSpecialPoints[i];
      const coords = toContainerPercent(rawX, rawY);

      seedPositions.push({
        ...coords,
        animationDelay: `${i * 0.05}s`,
        constellationPoint: true,
        isMainStar: true,
        pointIndex: i,
        seedIndex: seeds.indexOf(seed)
      });
    }
    
    // If we somehow have more than 12 seeds, place extras in a ring (unlikely)
    let extraRingIndex = 0;
    for (let i = specialPointCount; i < gatheredCount; i++) {
      const seed = gatheredSeeds[i];
      const angle = (extraRingIndex / Math.max(gatheredCount - specialPointCount, 1)) * 2 * Math.PI;
      extraRingIndex++;
      const ringRadiusPx = Math.min(containerW, containerH) * 0.3;
      const centerX = containerW / 2;
      const centerY = containerH / 2;
      const ringX = centerX + ringRadiusPx * Math.cos(angle);
      const ringY = centerY + ringRadiusPx * Math.sin(angle);

      seedPositions.push({
        left: `${(ringX / containerW) * 100}%`,
        top: `${(ringY / containerH) * 100}%`,
        coordX: (ringX / containerW) * 100,
        coordY: (ringY / containerH) * 100,
        animationDelay: `${(specialPointCount + i) * 0.05}s`,
        constellationPoint: false,
        isMainStar: false,
        seedIndex: seeds.indexOf(seed)
      });
    }
  } else {
    // Standard handling for all other cases
    // 4) Assign constellation points to the gathered seeds (up to pattern length)
    usablePoints = Math.min(gatheredCount, patternCount);
    for (let i = 0; i < usablePoints; i++) {
      const seed = gatheredSeeds[i];
      const [rawX, rawY] = pattern[i];
      const coords = toContainerPercent(rawX, rawY);

      seedPositions.push({
        ...coords,
        animationDelay: `${i * 0.05}s`,
        constellationPoint: true,
        isMainStar: true,
        pointIndex: i,
        seedIndex: seeds.indexOf(seed)
      });
    }

    // If more gathered than pattern points => place extras in ring
    ringIndex = 0;
    for (let i = usablePoints; i < gatheredCount; i++) {
      const seed = gatheredSeeds[i];
      const angle =
        (ringIndex / (Math.max(gatheredCount - usablePoints, 1))) * 2 * Math.PI;
      ringIndex++;
      const ringRadiusPx = Math.min(containerW, containerH) * 0.25;
      const centerX = containerW / 2;
      const centerY = containerH / 2;
      const ringX = centerX + ringRadiusPx * Math.cos(angle);
      const ringY = centerY + ringRadiusPx * Math.sin(angle);

      seedPositions.push({
        left: `${(ringX / containerW) * 100}%`,
        top: `${(ringY / containerH) * 100}%`,
        coordX: (ringX / containerW) * 100,
        coordY: (ringY / containerH) * 100,
        animationDelay: `${(usablePoints + ringIndex) * 0.05}s`,
        constellationPoint: false,
        isMainStar: false,
        seedIndex: seeds.indexOf(seed)
      });
    }
  }

  // 5) Assign leftover pattern points to ungathered seeds for "future positions"
  // For Blake special case, we don't need to show future positions when all seeds are gathered
  const isSpecialCase = allSeedsGathered && isBlakeConstellation;
  const leftoverPatternPoints = isSpecialCase ? [] : pattern.slice(usablePoints);
  const leftoverCount = leftoverPatternPoints.length;
  const ungatheredCount = ungatheredSeeds.length;
  const minCount = Math.min(ungatheredCount, leftoverCount);
  for (let i = 0; i < minCount; i++) {
    const seed = ungatheredSeeds[i];
    const [rawX, rawY] = leftoverPatternPoints[i];
    const coords = toContainerPercent(rawX, rawY);

    // Position cosmic eggs directly at constellation coordinates - no random offset
    // This creates the "eternal wisdom pattern" that users discover rather than construct
    seedPositions.push({
      left: coords.left,
      top: coords.top,
      coordX: coords.coordX,
      coordY: coords.coordY,
      // No futurePosition needed - they're already in the right place
      constellationPoint: true,
      isMainStar: false, // Ungathered seeds are not main stars yet
      pointIndex: usablePoints + i,
      animationDelay: `${(gatheredCount + i) * 0.05}s`,
      seedIndex: seeds.indexOf(seed)
    });
  }

  // Additional outer ring for remaining ungathered seeds
  ringIndex = 0;
  for (let i = minCount; i < ungatheredCount; i++) {
    const seed = ungatheredSeeds[i];
    const angle = (ringIndex / (Math.max(ungatheredCount - minCount, 1))) * 2 * Math.PI;
    ringIndex++;
    const ringRadiusPx = Math.min(containerW, containerH) * 0.3;
    const centerX = containerW / 2;
    const centerY = containerH / 2;
    const ringX = centerX + ringRadiusPx * Math.cos(angle);
    const ringY = centerY + ringRadiusPx * Math.sin(angle);

    seedPositions.push({
      left: `${(ringX / containerW) * 100}%`,
      top: `${(ringY / containerH) * 100}%`,
      coordX: (ringX / containerW) * 100,
      coordY: (ringY / containerH) * 100,
      animationDelay: `${(gatheredCount + i) * 0.05}s`,
      constellationPoint: false,
      isMainStar: false,
      seedIndex: seeds.indexOf(seed)
    });
  }

  // 6) Sort final positions to match the seeds array
  const sortedPositions: SeedPosition[] = new Array(seeds.length);
  for (let i = 0; i < seeds.length; i++) {
    const pos = seedPositions.find((p) => p.seedIndex === i);
    sortedPositions[i] = pos || {
      left: '50%',
      top: '50%',
      coordX: 50,
      coordY: 50,
      constellationPoint: false,
      isMainStar: false,
      seedIndex: i
    };
  }

  return {
    seedPositions: sortedPositions,
    boundingBox: { xMin, xMax, yMin, yMax, scale, offsetX, offsetY }
  };
}

/**
 * Computes line segments to draw between consecutive constellation points.
 * 
 * @param seedPositions - The result from calculateConstellationPositions().seedPositions
 * @param boundingBox - The additional bounding box info.
 * @param pattern - The original constellation pattern array
 * @param containerDimensions - The container width and height
 * @param constellation - The constellation data including name
 * @returns An array of line objects: { x1, y1, x2, y2 }, all in absolute pixel space for <line />
 */
export function calculateConstellationPaths(
  seedPositions: SeedPosition[],
  boundingBox: BoundingBox,
  pattern: number[][],
  containerDimensions: ContainerDimensions,
  constellation: ConstellationPattern
): LineSegment[] {
  if (!pattern || pattern.length < 2 || !boundingBox || !containerDimensions) {
    return [];
  }
  
  const { xMin, yMin, scale, offsetX, offsetY } = boundingBox;

  // Helper: pattern coords -> absolute pixel
  const toContainerPixels = (px: number, py: number) => {
    const dx = (px - (xMin || 0)) * (scale || 1) + (offsetX || 0);
    const dy = (py - (yMin || 0)) * (scale || 1) + (offsetY || 0);
    return { x: dx, y: dy };
  };

  // Check if this is Blake's fully gathered constellation
  const isBlakeSpecialCase = constellation?.name === "The Divine Vision" && 
    seedPositions.filter(pos => pos.isMainStar).length === 12;

  // Create line segments connecting pattern[i] -> pattern[i+1]
  const lines: LineSegment[] = [];
  
  // Create line segments connecting pattern[i] -> pattern[i+1]
  for (let i = 0; i < pattern.length - 1; i++) {
    const [xA, yA] = pattern[i];
    const [xB, yB] = pattern[i + 1];
    
    // For Blake's special case - only skip the specific central line
    if (isBlakeSpecialCase) {
      // This identifies the specific line in the middle that needs to be removed
      // The central line connects from center point to one of the sides
      const isCentralLine = (
        (xA === 50 && yA === 50 && xB === 50 && yB === 35) ||
        (xA === 50 && yA === 35 && xB === 50 && yB === 50) ||
        // Also check for other potential connections to the center
        (xA === 50 && yA === 50) || (xB === 50 && yB === 50)
      );
      
      if (isCentralLine) {
        continue; // Skip only this specific line
      }
    }
    
    const ptA = toContainerPixels(xA, yA);
    const ptB = toContainerPixels(xB, yB);
    
    lines.push({
      x1: ptA.x, y1: ptA.y,
      x2: ptB.x, y2: ptB.y
    });
  }

  return lines;
}