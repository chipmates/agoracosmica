/**
 * Helper for translating constellation names
 * Maps constellation names to translation keys
 */

/**
 * Constellation name type (literal union of all names)
 */
export type ConstellationName = 
  | "The Divine Vision"
  | "Spacetime Curvature"
  | "The Eternal Dao"
  | "The Mythic Round"
  | "The Will and Representation"
  | "Harmonic Constellation"
  | "The North Star Trail"
  | "The Dream Mountain"
  | "The Equal Balance"
  | "The Emerald Vision"
  | "The Bernoulli Constellation"
  | "The Moonlit Window"
  | "The Stoic Taurus"
  | "The Mandala of Swaraj"
  | "The Two Fridas"
  | "The Flowing Consciousness"
  | "The Bard's Quill"
  | "The Enlightenment Posture"
  | "The Freed Horizon"
  | "The Social Circle"
  | "The Vitruvian Ideal"
  | "Plato's Cave Allegory"
  | "The Will to Power Lightning"
  | "The Alchemical Quaternity"
  | "The Ecstatic Whirl"
  | "E Pur Si Muove"
  | "Candle of Enlightenment"
  | "The Caged Bird Freedom"
  | "Ensō Circle";

/**
 * Translation key type
 */
export type ConstellationTranslationKey = `constellations.names.${string}`;

/**
 * Map type for constellation names to translation keys
 */
type ConstellationNameMap = {
  [K in ConstellationName]: ConstellationTranslationKey;
};

// Map of English constellation names to translation keys
const CONSTELLATION_NAME_TO_KEY: ConstellationNameMap = {
  "The Divine Vision": "constellations.names.theDivineVision",
  "Spacetime Curvature": "constellations.names.spacetimeCurvature",
  "The Eternal Dao": "constellations.names.theEternalDao",
  "The Mythic Round": "constellations.names.theMythicRound",
  "The Will and Representation": "constellations.names.theWillAndRepresentation",
  "Harmonic Constellation": "constellations.names.harmonicConstellation",
  "The North Star Trail": "constellations.names.theNorthStarTrail",
  "The Dream Mountain": "constellations.names.theDreamMountain",
  "The Equal Balance": "constellations.names.theEqualBalance",
  "The Emerald Vision": "constellations.names.theEmeraldVision",
  "The Bernoulli Constellation": "constellations.names.theBernoulliConstellation",
  "The Moonlit Window": "constellations.names.theMoonlitWindow",
  "The Stoic Taurus": "constellations.names.theStoicTaurus",
  "The Mandala of Swaraj": "constellations.names.theMandalaOfSwaraj",
  "The Two Fridas": "constellations.names.theTwoFridas",
  "The Flowing Consciousness": "constellations.names.theFlowingConsciousness",
  "The Bard's Quill": "constellations.names.theBardsQuill",
  "The Enlightenment Posture": "constellations.names.theEnlightenmentPosture",
  "The Freed Horizon": "constellations.names.theFreedHorizon",
  "The Social Circle": "constellations.names.theSocialCircle",
  "The Vitruvian Ideal": "constellations.names.theVitruvianIdeal",
  "Plato's Cave Allegory": "constellations.names.platosCaveAllegory",
  "The Will to Power Lightning": "constellations.names.theWillToPowerLightning",
  "The Alchemical Quaternity": "constellations.names.theAlchemicalQuaternity",
  "The Ecstatic Whirl": "constellations.names.theEcstaticWhirl",
  "E Pur Si Muove": "constellations.names.ePurSiMuove",
  "Candle of Enlightenment": "constellations.names.candleOfEnlightenment",
  "The Caged Bird Freedom": "constellations.names.theCagedBirdFreedom",
  "Ensō Circle": "constellations.names.ensoCircle"
};

/**
 * Get the translation key for a constellation name
 * @param name - The English constellation name
 * @returns The translation key or null if not found
 */
export function getConstellationTranslationKey(name: string): ConstellationTranslationKey | null {
  return (CONSTELLATION_NAME_TO_KEY as Record<string, ConstellationTranslationKey>)[name] || null;
}

export default {
  getConstellationTranslationKey
};