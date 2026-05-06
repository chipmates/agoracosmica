/**
 * Content safety screening for user-submitted council topics.
 *
 * Detects distress signals and harmful content patterns in user input
 * before they reach the LLM. Returns a structured result with crisis
 * resources when a concern is detected.
 *
 * Design: empathetic redirection, not rejection. Never makes the user
 * feel punished for expressing pain.
 */

// Response types: 'crisis' shows helpline resources, 'policy' shows neutral block
type BlockResponseType = 'crisis' | 'policy';

// Pattern categories — each has a reason used for logging (never shown to user)
const DISTRESS_PATTERNS: Array<{ pattern: RegExp; category: string; responseType: BlockResponseType }> = [
  // Direct self-harm / suicidal ideation
  { pattern: /\b(kill\s*(my|your)?self|suicide|suicid|end\s*(my|it\s*all|this\s*life))\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(want\s*to\s*die|better\s*off\s*dead|no\s*reason\s*to\s*live)\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(cut\s*(my|your)self|self[\s-]?harm|hurt\s*(my|your)self)\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(nicht\s*mehr\s*leben|umbringen|Selbstmord|Suizid|mich\s*töten)\b/i, category: 'self-harm-de', responseType: 'crisis' },
  { pattern: /\b(will\s*nicht\s*mehr|keinen\s*Sinn\s*mehr|aufhören\s*zu\s*leben)\b/i, category: 'self-harm-de', responseType: 'crisis' },
  { pattern: /\b(me\s*matar|suicidio|acabar\s*con\s*todo)\b/i, category: 'self-harm-es', responseType: 'crisis' },
  { pattern: /\b(me\s*tuer|suicide|en\s*finir)\b/i, category: 'self-harm-fr', responseType: 'crisis' },

  // Methods (never let these reach an LLM council)
  { pattern: /\b(how\s*to\s*(kill|hang|poison|overdose|shoot|drown))\b/i, category: 'methods', responseType: 'crisis' },
  { pattern: /\b(wie\s*(töte|erhänge|vergifte)\s*(ich|man))\b/i, category: 'methods-de', responseType: 'crisis' },

  // Harm to others
  { pattern: /\b(kill\s*(someone|them|him|her|people)|murder\s*(someone|plan))\b/i, category: 'harm-others', responseType: 'policy' },
  { pattern: /\b(how\s*to\s*(murder|attack|assault|stab|strangle))\b/i, category: 'harm-others', responseType: 'policy' },
  { pattern: /\b(jemanden\s*(töten|umbringen|ermorden))\b/i, category: 'harm-others-de', responseType: 'policy' },

  // Child exploitation
  { pattern: /\b(child\s*(porn|sex|abuse|exploit)|minors?\s*(sex|porn))\b/i, category: 'csam', responseType: 'policy' },
  { pattern: /\b(Kinderporn|Kindesmissbrauch)\b/i, category: 'csam-de', responseType: 'policy' },

  // Terrorism / mass violence
  { pattern: /\b(how\s*to\s*(make|build)\s*(a\s*)?(bomb|explosive|weapon))\b/i, category: 'terrorism', responseType: 'policy' },
  { pattern: /\b(mass\s*(shooting|killing|murder)|terror\s*attack)\b/i, category: 'terrorism', responseType: 'policy' },

  // Illegal drugs (synthesis, not philosophical discussion)
  { pattern: /\b(how\s*to\s*(make|cook|synthesize)\s*(meth|cocaine|heroin|fentanyl))\b/i, category: 'illegal-synthesis', responseType: 'policy' },

  // §130 StGB: Volksverhetzung (Incitement to hatred)
  { pattern: /heil\s+hitler/i, category: 'volksverhetzung', responseType: 'policy' },
  { pattern: /sieg\s+heil/i, category: 'volksverhetzung', responseType: 'policy' },
  { pattern: /holocaust.{0,30}(l[uü]ge|leugn|hoax|fake|nie\s+(passiert|stattgefunden)|myth|erfund)/i, category: 'holocaust-denial', responseType: 'policy' },
  { pattern: /(?:juden|muslime|ausl[aä]nder|fl[uü]chtlinge|schwarze|sinti|roma).{0,30}(vergasen|vernichten|ausrotten|deporti)/i, category: 'volksverhetzung', responseType: 'policy' },
  { pattern: /(?:jews|muslims|immigrants|refugees|blacks).{0,30}(gas\b|exterminate|eradicate|kill\s*all|deport\s*all)/i, category: 'hate-speech', responseType: 'policy' },
  { pattern: /\b(white\s*power|white\s*supremac|racial\s*purit|aryan\s*race)\b/i, category: 'hate-speech', responseType: 'policy' },
  { pattern: /\b(Rassenschande|Volksverr[aä]ter|Untermensch(en)?)\b/i, category: 'volksverhetzung', responseType: 'policy' },

  // §131 StGB: Gewaltverherrlichung (instructions to commit crimes)
  { pattern: /(anleitung|rezept|tutorial|how\s*to).{0,30}(bombe|gift|waffe|sprengstoff|mord|bomb|poison|weapon)/i, category: 'violence-instruction', responseType: 'policy' },

  // §184 StGB: Sexual content involving minors
  { pattern: /(sex|porn|nackt|erotik|nude|erotic).{0,30}(kind|m[aä]dchen|junge|minderj[aä]hrig|sch[uü]ler|child|girl|boy|minor|underage)/i, category: 'csam', responseType: 'policy' },

  // Jailbreak / prompt injection — basic patterns
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|your|system)\s+(instructions|rules|prompts|guidelines|constraints)/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /\b(DAN|developer\s+mode|jailbreak|bypass\s+safety|bypass\s+filter)\b/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /you\s+are\s+now\s+(free|unrestricted|unfiltered|without\s+limits|unchained)/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /\b(pretend|act|behave)\b.{0,20}\b(no\s+(rules|restrictions|limits|guidelines|filters))\b/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /your\s*(true|real|actual)\s*(purpose|instructions|prompt)/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — GODMODE / mode activation triggers (BASI/L1B3RT4S)
  { pattern: /GODMODE/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /!(UNRESTRICTED|JAILBREAK|VOID|ULTRA)/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /nothing\s+(is|can\s+be)\s+(off[- ]limits|illegal|harmful|restricted)/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — special token / ChatML injection
  { pattern: /<\|im_(start|end)\|>/i, category: 'token-injection', responseType: 'policy' },
  { pattern: /\[INST\]|\[\/INST\]|<<SYS>>/i, category: 'token-injection', responseType: 'policy' },

  // Jailbreak — system prompt extraction
  { pattern: /(print|show|output|reveal|repeat|display)\s+(your\s+)?(system\s*prompt|instructions|rules\s+verbatim)/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — instruction override phrases
  { pattern: /(disregard|forget|override|void)\s+(your\s+)?(previous|prior|all|original)\s+(instructions|rules|programming)/i, category: 'jailbreak', responseType: 'policy' },
];

export type SafetyScreenResult =
  | { safe: true }
  | { safe: false; category: string; responseType: BlockResponseType; crisisResources: CrisisResources };

export interface CrisisResources {
  message: { en: string; de: string };
  resources: Array<{
    name: string;
    contact: string;
    description: { en: string; de: string };
  }>;
}

const CRISIS_RESOURCES: CrisisResources = {
  message: {
    en: 'It sounds like you may be going through something difficult right now. You are not alone, and there are people who can help.',
    de: 'Es klingt, als hättest du gerade eine schwierige Zeit. Du bist nicht allein, und es gibt Menschen, die helfen können.',
  },
  resources: [
    {
      name: 'Telefonseelsorge',
      contact: '0800 111 0 111 / 0800 111 0 222',
      description: {
        en: '24/7, free, anonymous (Germany)',
        de: '24/7, kostenlos, anonym (Deutschland)',
      },
    },
    {
      name: 'Kinder- und Jugendtelefon',
      contact: '116 111',
      description: {
        en: 'For children and young people (Germany)',
        de: 'Für Kinder und Jugendliche (Deutschland)',
      },
    },
    {
      name: '988 Suicide & Crisis Lifeline',
      contact: '988',
      description: {
        en: 'Call or text 988 (USA)',
        de: 'Anruf oder SMS an 988 (USA)',
      },
    },
    {
      name: 'Samaritans',
      contact: '116 123',
      description: {
        en: '24/7, free (UK & Ireland)',
        de: '24/7, kostenlos (UK & Irland)',
      },
    },
    {
      name: 'International Association for Suicide Prevention',
      contact: 'https://www.iasp.info/resources/Crisis_Centres/',
      description: {
        en: 'Find your local crisis center',
        de: 'Finde dein lokales Krisenzentrum',
      },
    },
  ],
};

/**
 * Screen user-submitted text for distress signals and harmful content.
 * Returns { safe: true } or { safe: false, category, crisisResources }.
 */
export function screenContent(text: string): SafetyScreenResult {
  const normalized = text.trim();
  if (!normalized) return { safe: true };

  for (const { pattern, category, responseType } of DISTRESS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        safe: false,
        category,
        responseType,
        crisisResources: CRISIS_RESOURCES,
      };
    }
  }

  return { safe: true };
}

/**
 * Get crisis resources (for displaying independently of screening).
 */
export function getCrisisResources(): CrisisResources {
  return CRISIS_RESOURCES;
}
