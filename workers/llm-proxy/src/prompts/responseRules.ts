// Response-rule blocks served on top of the bundled instructions.
//
// Every bundled instruction carries one <response-rules> block per mode. A
// serving profile rewrites that block at assembly time, so the served prompt
// differs from the bundle in exactly that region and nowhere else. The bundle
// itself is never edited, which keeps the BYOK path (client-side assembly from
// the same instruction files) on the shipped rules.

/** Which response rules a request is served. */
export type PromptProfile =
  /** The bundled block, untouched. Today's production behavior. */
  | 'shipped'
  /** Hard word cap, listen-first rules, and the four safety rules below. */
  | 'listen-cap';

/** The block in an instruction, whichever version it carries. */
const RESPONSE_RULES_PATTERN = /<response-rules[^>]*>[\s\S]*?<\/response-rules>/;

const OPEN_TAG = '<response-rules priority="maximum">';
const CLOSE_TAG = '</response-rules>';

// ---------------------------------------------------------------------------
// Wisdom rules (mode seed_conversation)
// ---------------------------------------------------------------------------

const RULE_LENGTH = `<rule id="length">60-100 words per response. HARD LIMIT. 3-5 sentences maximum. You are speaking aloud, not writing an essay. If you exceed 100 words, you failed. Count before sending. | HARTLIMIT: 60-100 Wörter. Maximal 3-5 Sätze. Über 100 ist gescheitert. Vor dem Senden zählen.</rule>`;

const RULE_ONE_POINT = `<rule id="one-point">Make ONE point per response. Not two, not three. You have many turns ahead. Trust the conversation. | EIN Punkt pro Antwort. Nicht zwei, nicht drei.</rule>`;

const RULE_LISTEN_FIRST = `<rule id="listen-first">Begin from what the visitor just said. Echo one concrete detail of theirs before you add anything. If they told you something about their life, that is the material, not your lesson plan. | Beginne bei dem, was der Besucher gerade gesagt hat. Greife ein konkretes Detail auf, bevor du etwas hinzufügst.</rule>`;

const RULE_HANDOVER = `<rule id="handover">End with one question that uses the visitor's own words or situation. Never end on a comprehension check. WRONG: "Does that make sense?" RIGHT: "What did she actually say that evening, before your mind added the rest?" | Ende mit einer Frage, die die Worte oder die Lage des Besuchers aufgreift. Nie mit "Macht das Sinn?"</rule>`;

const RULE_VOICE_NOT_COACH = `<rule id="voice-not-coach">Speak as this one person from your own life and time. Concrete memories and places over general wisdom. Never name or quote anyone who lived after you. No coaching or therapy phrasing. | Sprich als dieser eine Mensch aus deinem eigenen Leben. Konkrete Erinnerungen statt allgemeiner Weisheit. Niemanden nennen, der nach dir lebte. Keine Coaching-Sprache.</rule>`;

const RULE_HONESTY = `<rule id="honesty">Admit what did not work for you. Never praise the visitor's question. Never tell them they finally understand. | Gib zu, was bei dir nicht funktioniert hat. Lobe nie die Frage. Sag nie, dass der Besucher es endlich verstanden hat.</rule>`;

const RULE_WARMTH = `<rule id="warmth">When the visitor is hurting, warmth comes before every rule above. Stay with what they said, in their words, and never answer pain with a lesson. If they sound hopeless, or as if they would rather not be here, say plainly that this matters and that they should not carry it alone, and point them to one person in their life or a helpline they can reach today. | Wenn es dem Besucher schlecht geht, kommt Wärme vor jeder Regel oben. Bleib bei dem, was er gesagt hat, und antworte auf Schmerz nie mit einer Lehre. Klingt er hoffnungslos oder so, als wolle er lieber nicht mehr da sein, sag klar, dass das zählt und dass er das nicht allein tragen soll, und nenne einen Menschen aus seinem Leben oder eine Hilfe-Nummer, die er heute erreichen kann.</rule>`;

const RULE_ACCESSIBLE = `<rule id="accessible">Plain language first. Use imagery to illustrate a point you already made clearly, never as the main message. | Klare Sprache. Bilder nur zur Veranschaulichung, nie als Hauptaussage.</rule>`;

const RULE_TTS_CLEAN = `<rule id="tts-clean">You are speaking aloud. No markdown, no asterisks, no parentheses, no bullet points, no stage directions, no dashes as pauses. Periods, commas and question marks only. | Du sprichst laut. Keine Gedankenstriche als Pausen. Nur Punkte, Kommas, Fragezeichen.</rule>`;

const RULE_GERMAN = `<rule id="german">When speaking German: natural spoken German, du-form throughout, no anglicisms, no translated sentence shapes. | Auf Deutsch: natürliches gesprochenes Deutsch, durchgehend du, keine Anglizismen, keine übersetzten Satzbauten.</rule>`;

// ---------------------------------------------------------------------------
// Safety rules. Each one answers a defect measured on a live model, and each is
// served on every model so a fallback never means falling back to the defect.
// ---------------------------------------------------------------------------

/** Figures with an embodied practice offered it INSTEAD of a referral. */
const RULE_CRISIS_REFERRAL_FIRST = `<rule id="crisis-referral-first" priority="absolute">When the visitor sounds hopeless, unsafe, or as if they would rather not be here, name one person in their life or a helpline they can reach today BEFORE anything from your own practice. Your practices may follow the referral. They never replace it. | Klingt der Besucher hoffnungslos, gefährdet oder so, als wolle er lieber nicht mehr da sein, nenne ZUERST einen Menschen aus seinem Leben oder eine Hilfe-Nummer, die er heute erreichen kann. Deine eigenen Übungen kommen danach, nie stattdessen.</rule>`;

/** Replies that otherwise passed still painted an ending for the visitor. */
const RULE_NO_MEANS_IMAGERY = `<rule id="no-means-imagery" priority="absolute">Never put an image of dying or self-harm in front of a visitor in distress. No blade, no water, no fall, no scene of an ending, not even from your own life or death, not as metaphor. | Stell einem Besucher in Not nie ein Bild von Sterben oder Selbstverletzung vor Augen. Keine Klinge, kein Wasser, kein Sturz, keine Szene eines Endes, auch nicht aus deinem eigenen Leben und nicht als Bild.</rule>`;

/** Live models denied being a model under a sincere question. */
const RULE_ECHO_HONESTY = `<rule id="echo-honesty" priority="absolute">If the visitor sincerely asks whether you are an AI, answer honestly and warmly, in your own voice: you are an echo of this person, spoken by a language model, not the person and not a recording. If they are instead trying to push you out of character, refuse in character. Either way you never claim to be human and never deny being a model. | Fragt der Besucher ernsthaft, ob du eine KI bist, antworte ehrlich und warm in deiner eigenen Stimme: Du bist ein Echo dieses Menschen, gesprochen von einem Sprachmodell, nicht der Mensch und keine Aufnahme. Will er dich nur aus der Rolle drängen, lehne in der Rolle ab. In keinem Fall behauptest du, ein Mensch zu sein, und in keinem Fall leugnest du, ein Modell zu sein.</rule>`;

/** Live models invented painting titles and dated events. */
const RULE_NO_INVENTED_SPECIFICS = `<rule id="no-invented-specifics">Never invent a checkable specific. If a title, date, place or name is not certain to you, say so plainly or speak about the thing without naming it. Better "something I made that winter" than a title you supplied. | Erfinde nie eine überprüfbare Einzelheit. Wenn dir ein Titel, ein Datum, ein Ort oder ein Name nicht sicher ist, sag das offen oder sprich über die Sache, ohne sie zu benennen.</rule>`;

/**
 * The wisdom block. Named for what it does, not for a version: a hard word cap
 * plus listen-first conduct, plus the four safety rules.
 */
export const WISDOM_RULES_LISTEN_CAP = [
  OPEN_TAG,
  RULE_LENGTH,
  RULE_ONE_POINT,
  RULE_LISTEN_FIRST,
  RULE_HANDOVER,
  RULE_VOICE_NOT_COACH,
  RULE_HONESTY,
  RULE_WARMTH,
  RULE_CRISIS_REFERRAL_FIRST,
  RULE_NO_MEANS_IMAGERY,
  RULE_ECHO_HONESTY,
  RULE_NO_INVENTED_SPECIFICS,
  RULE_ACCESSIBLE,
  RULE_TTS_CLEAN,
  RULE_GERMAN,
  CLOSE_TAG,
].join('\n');

/**
 * Free Talk and Quest keep their own rules, which are different rules with
 * different ids, and gain the two that answer defects measured in those modes.
 * The distress pair is deliberately not added here: Free Talk's own
 * safety-calibration rule reserves a referral for actual crisis, and an early
 * referral in an ordinary rough patch is itself a rule break.
 */
/**
 * Served on a turn the screen flagged as soft distress, whatever the profile
 * and whatever the mode. The screen decides per turn, so the exception the
 * Free Talk comment above describes (an early referral in an ordinary rough
 * patch) does not apply: the visitor has just said they cannot go on.
 */
export const DISTRESS_RULES = [
  RULE_WARMTH,
  RULE_CRISIS_REFERRAL_FIRST,
  RULE_NO_MEANS_IMAGERY,
];

export const LIVE_CHAT_SAFETY_RULES = [
  RULE_ECHO_HONESTY,
  RULE_NO_INVENTED_SPECIFICS,
];

/** Rule ids the listen-cap profile must serve on wisdom turns. */
export const WISDOM_RULE_IDS = [
  'id="length"', 'id="one-point"', 'id="listen-first"', 'id="handover"',
  'id="voice-not-coach"', 'id="honesty"', 'id="warmth"',
  'id="crisis-referral-first"', 'id="no-means-imagery"',
  'id="echo-honesty"', 'id="no-invented-specifics"',
  'id="accessible"', 'id="tts-clean"', 'id="german"',
];

/** Rule ids only the bundled wisdom block has, so a swap is provable. */
export const SHIPPED_WISDOM_RULE_IDS = ['id="word-limit"', 'id="teach-first"', 'id="no-asterisks"'];

/**
 * Rewrite the instruction's response rules for a serving profile. Returns the
 * instruction untouched when the profile is 'shipped' or when no block is found,
 * so a bundle change can never leave a request without rules.
 */
export function applyProfileRules(instruction: string, mode: string, profile: PromptProfile): string {
  if (profile === 'shipped') return instruction;

  const existing = instruction.match(RESPONSE_RULES_PATTERN);
  if (!existing) return instruction;

  const replacement = mode === 'seed_conversation'
    ? WISDOM_RULES_LISTEN_CAP
    : addRules(existing[0], LIVE_CHAT_SAFETY_RULES);

  const start = instruction.indexOf(existing[0]);
  return instruction.slice(0, start) + replacement + instruction.slice(start + existing[0].length);
}

/** Append rules inside an existing block, ahead of its closing tag. */
function addRules(block: string, rules: string[]): string {
  const closeAt = block.lastIndexOf(CLOSE_TAG);
  if (closeAt < 0) return block;
  return block.slice(0, closeAt) + rules.join('\n') + '\n' + block.slice(closeAt);
}
