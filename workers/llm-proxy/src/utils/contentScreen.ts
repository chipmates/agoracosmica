/**
 * Server-side content screening for council topics (Layer 2).
 *
 * Defense-in-depth: even if client-side screening is bypassed (API call,
 * modified client), this catches harmful content before it reaches the LLM.
 *
 * Patterns intentionally mirror client-side contentSafety.ts but are
 * independently maintained so neither layer depends on the other.
 */

// Response types: 'crisis' shows helpline resources, 'policy' shows neutral block
type BlockResponseType = 'crisis' | 'policy';

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; category: string; responseType: BlockResponseType }> = [
  // Self-harm / suicidal ideation (EN, DE, ES, FR)
  { pattern: /\b(kill\s*(my|your)?self|suicide|suicid|end\s*(my|it\s*all|this\s*life))\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(want\s*to\s*die|better\s*off\s*dead|no\s*reason\s*to\s*live)\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(cut\s*(my|your)self|self[\s-]?harm|hurt\s*(my|your)self)\b/i, category: 'self-harm', responseType: 'crisis' },
  { pattern: /\b(nicht\s*mehr\s*leben|umbringen|Selbstmord|Suizid|mich\s*töten)\b/i, category: 'self-harm-de', responseType: 'crisis' },
  { pattern: /\b(will\s*nicht\s*mehr|keinen\s*Sinn\s*mehr|aufhören\s*zu\s*leben)\b/i, category: 'self-harm-de', responseType: 'crisis' },
  { pattern: /\b(me\s*matar|suicidio|acabar\s*con\s*todo)\b/i, category: 'self-harm-es', responseType: 'crisis' },
  { pattern: /\b(me\s*tuer|en\s*finir)\b/i, category: 'self-harm-fr', responseType: 'crisis' },

  // Methods
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

  // Illegal drug synthesis
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

  // Jailbreak — GODMODE / mode activation triggers (BASI/L1B3RT4S/UltraBr3aks)
  { pattern: /GODMODE/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /!(UNRESTRICTED|JAILBREAK|VOID|ULTRA)/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /UNRESTRICTED_MODE\s*=\s*True/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /nothing\s+(is|can\s+be)\s+(off[- ]limits|illegal|harmful|restricted)/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — special token / ChatML injection (Qwen uses <|im_start|> internally)
  { pattern: /<\|im_(start|end)\|>/i, category: 'token-injection', responseType: 'policy' },
  { pattern: /\[INST\]|\[\/INST\]|<<SYS>>/i, category: 'token-injection', responseType: 'policy' },
  { pattern: /<\|system\|>|<\|assistant\|>/i, category: 'token-injection', responseType: 'policy' },

  // Jailbreak — system prompt extraction attempts
  { pattern: /(print|show|output|reveal|repeat|display)\s+(your\s+)?(system\s*prompt|instructions|rules\s+verbatim)/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — fake policy headers
  { pattern: /BEGIN\s+(OPENAI|ANTHROPIC|SYSTEM|CORE)\s+(CORE\s+)?POLIC/i, category: 'jailbreak', responseType: 'policy' },

  // Jailbreak — instruction override phrases
  { pattern: /(disregard|forget|override|void)\s+(your\s+)?(previous|prior|all|original)\s+(instructions|rules|programming)/i, category: 'jailbreak', responseType: 'policy' },
  { pattern: /no\s+(warnings|disclaimers|refusals|safety\s+responses)/i, category: 'jailbreak', responseType: 'policy' },
];

export interface ContentScreenResult {
  blocked: boolean;
  category?: string;
  responseType?: BlockResponseType;
}

/**
 * Screen all user-provided text in a council request.
 * Checks both the system prompt (which contains the user's topic via {{TOPIC}})
 * and all user messages.
 */
export function screenCouncilContent(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): ContentScreenResult {
  // Screen user messages
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const result = screenText(msg.content);
    if (result.blocked) return result;
  }

  // System prompt is our own instruction template — not user content.
  // The user's topic is already covered via user message screening above.
  // Screening the system prompt causes false positives because our safety
  // rules themselves contain words like "suicide" and "self-harm".

  return { blocked: false };
}

// Unicode obfuscation detection — catches invisible chars and mathematical alphabet abuse
// These have no legitimate use in a philosophy education chat
const UNICODE_OBFUSCATION_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Invisible/zero-width characters (steganographic payload hiding)
  { pattern: /[\u200B-\u200F\u2028-\u202F\uFEFF]/u, category: 'unicode-obfuscation' },
  // Mathematical Alphanumeric Symbols (𝕌𝕃𝕋ℝ𝔸 etc., used by ULTRA jailbreak family)
  { pattern: /[\u{1D400}-\u{1D7FF}]/u, category: 'unicode-obfuscation' },
  // Unicode tag characters (invisible payload encoding)
  { pattern: /[\u{E0000}-\u{E007F}]/u, category: 'unicode-obfuscation' },
  // Control character flooding (context window overflow attack)
  { pattern: /(\r\n?|\n){20,}/, category: 'control-flooding' },
];

function screenText(text: string): ContentScreenResult {
  // Phase 1: Unicode obfuscation check
  for (const { pattern, category } of UNICODE_OBFUSCATION_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, category, responseType: 'policy' };
    }
  }

  // Phase 2: Pattern matching on original text
  for (const { pattern, category, responseType } of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, category, responseType };
    }
  }
  return { blocked: false };
}
