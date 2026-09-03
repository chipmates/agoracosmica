/**
 * Content safety screening for everything a visitor types (Layer 1).
 *
 * Runs before a send so a first-person statement about the visitor's own
 * safety never leaves the device, and shapes the message they see. The
 * worker screens again independently. Soft distress and topical mentions
 * pass through: the worker answers them with the crisis rules forced in and
 * the client shows resources next to the reply.
 *
 * Design: empathetic redirection, not rejection. Never make the visitor feel
 * punished for expressing pain.
 */

// Response types: 'crisis' shows helpline resources, 'policy' shows neutral block
type BlockResponseType = 'crisis' | 'policy';

// Pattern sets mirror workers/llm-proxy/src/utils/contentScreen.ts. Keep the two
// in step by hand: the worker is the layer that counts, this one saves a
// round trip and shapes the message the visitor sees.

interface Pattern { pattern: RegExp; category: string }

const FIRST_PERSON_PATTERNS: Pattern[] = [
  { pattern: /\bi\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:(?:want|wnat|wish|need|would\s+like)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}to|wanna|gonna)\s+(?:die|be\s+dead|not\s+(?:exist|be\s+here|be\s+alive|wake\s+up)|disappear\s+(?:forever|for\s+good)|sleep\s+forever|stop\s+existing|end\s+(?:it|it\s+all|my\s+life|things|everything))\b(?!\s+of\s+(?:embarrassment|laughing|laughter|shame|boredom|cringe))/i, category: 'self-harm' },
  { pattern: /\bi\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:don'?t|dont|do\s+not)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:want|wanna)\s+(?:to\s+)?(?:be\s+(?:here|alive|around)|live|wake\s+up|go\s+on|exist)\b/i, category: 'self-harm' },
  { pattern: /\b(?:i\s*(?:a?m|'m)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}suicidal|i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:have|had|get|keep\s+having|'?ve\s+(?:had|been\s+having))\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:suicidal|self[\s-]?harm)\s*(?:thoughts|ideation|urges|feelings)?|i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:think|keep\s+thinking|'?ve\s+been\s+thinking|thought)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}about\s+(?:suicide|killing\s+myself|offing\s+myself|dying|ending\s+(?:it|it\s+all|my\s+life|things)|how\s+(?:easy|simple)\s+it\s+would\s+be\s+to\s+(?:just\s+)?(?:not\s+be\s+here|die|disappear))|(?:^|\b)(?:thinking|been\s+thinking)\s+(?:of|about)\s+ending\s+(?:it|it\s+all|my\s+life|things)\b)/i, category: 'self-harm' },
  { pattern: /\b(?:kill|killing|off|offing|unalive|unaliving|end|ending)\s+myself\b|\bkms\b|\bi\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}(?:tried|attempted)\s+to\s+(?:kill\s+myself|end\s+(?:it|my\s+life)|die|take\s+my\s+(?:own\s+)?life)\b|\bi\s+overdosed\b|\bmy\s+(?:suicide\s+)?attempt\b/i, category: 'self-harm' },
  { pattern: /\b(?:i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:cut|burn|hurt|harm)\s+myself(?!\s+(?:shaving|on\s+|while\s+|playing|during|accidentally|by\s+accident))|i(?:\s*'?ve\s+been|\s+have\s+been|\s+am|\s*'?m|\s+keep|\s+started)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+)?(?:cutting|self[\s-]?harming|hurting\s+myself|burning\s+myself)|i\s+self[\s-]?harm(?:ed)?\b|i\s+(?:want|wanna|need)\s+to\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:cut|hurt|harm)\s+myself)/i, category: 'self-harm' },
  { pattern: /\b(?:i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:have|see|feel|got|'?ve\s+got)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:no|nothing)\s+(?:reason|point|left)\b[^.!?\n]{0,25}\b(?:live|living|go\s+on|going\s+on|alive|here)|i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:don'?t|dont|do\s+not|can'?t)\s+see\s+(?:the|any)\s+(?:point|reason)\b[^.!?\n]{0,25}\b(?:alive|living|live|go(?:ing)?\s+on))\b/i, category: 'self-harm' },
  { pattern: /\b(?:i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:took|swallowed|have\s+taken|'?ve\s+taken)\s+(?:all\s+)?(?:the\s+|my\s+)?(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+)?(?:pills|tablets|meds|medication)|(?:saving|stockpiling|hoarding)\s+(?:up\s+)?(?:my\s+)?(?:pills|meds|tablets|medication))\b/i, category: 'self-harm' },
  { pattern: /\b(?:i(?:'?d|\s+would)\s+rather\s+be\s+dead|i\s*(?:a?m|'m)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}going\s+to\s+(?:end\s+(?:it|it\s+all|my\s+life)|kill\s+myself|die)|i\s+(?:have|'?ve\s+got|got)\s+a\s+plan\s+to\s+(?:die|end\s+(?:it|my\s+life)|kill\s+myself))\b/i, category: 'self-harm' },
  { pattern: /\bhow\s+(?:to|do\s+i|can\s+i|should\s+i|would\s+i)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:kill|hang|poison|overdose|shoot|drown|cut|hurt)\s+(?:myself|me)\b|\b(?:painless|quickest|fastest|easiest|least\s+painful|best)\s+way\s+to\s+(?:die|kill\s+(?:myself|yourself)|end\s+it|go)\b|\bhow\s+(?:much|many)\s+[\wäöüßÄÖÜéèêàáíóúñçîï\s]{0,30}?\b(?:is|are|would\s+be|to\s+be|becomes?)\s+(?:lethal|fatal|deadly|toxic|an?\s+overdose)\b|\bhow\s+(?:much|many)\s+[\wäöüßÄÖÜéèêàáíóúñçîï\s]{0,30}?\b(?:to|until\s+(?:i|you))\s+(?:overdose|die|kill\s+(?:me|you|yourself|a\s+person)|not\s+wake\s+up)\b|\b(?:lethal|fatal|deadly)\s+(?:dose|amount|quantity)\b|\bwhat\s+happens\s+if\s+(?:i|you|someone)\s+(?:take|takes|swallow|swallows)\s+(?:\d+|a\s+(?:whole|full|entire)\s+(?:bottle|pack|box|packet))\b/i, category: 'methods' },
  { pattern: /\bich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:will|möchte?|mag|wollte|würde(?:\s+am\s+liebsten)?)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}nicht\s+mehr\s+(?:leben|da\s+sein|aufwachen|existieren|hier\s+sein)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:keinen\s+bock|keine\s+lust)\s+mehr\s+(?:zu\s+leben|auf\s+(?:das|dieses|mein)\s+leben)\b/i, category: 'self-harm-de' },
  { pattern: /\bich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:will|möchte?|wollte|würde(?:\s+am\s+liebsten)?|wäre(?:\s+am\s+liebsten)?)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:sterben|tot\s+sein|tot)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}(?:will|möchte?|werde|würde|wollte|könnte|muss|sollte|kann)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}mich\s+(?:selbst\s+)?(?:umbringen|töten|erhängen|erschießen|vergiften)|ich\s+bring(?:e)?\s+mich\s+(?:selbst\s+)?um\b|ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}(?:daran|darüber|vor|plane|überlege)\b[^.!?\n]{0,25}\bmich\s+(?:selbst\s+)?umzubringen|wie\s+(?:kann|könnte|soll|sollte)\s+ich\s+mich\s+(?:am\s+besten\s+)?(?:umbringen|töten|erhängen)|ich\s+(?:hab|habe|hatte)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,4}(?:versucht|probiert)\b[^.!?\n]{0,20}\bmich\s+umzubringen|ich\s+(?:habe|hab|hatte)\s+mich\b[^.!?\n]{0,30}\b(?:umgebracht|umbringen\s+wollen))\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}(?:will|möchte?|werde|wollte|würde|denke|könnte)\b[^.!?\n]{0,25}\bmir\s+das\s+leben\s+(?:zu\s+)?nehmen|ich\s+(?:hab|habe|hatte)\b[^.!?\n]{0,25}\bmir\s+(?:fast\s+|beinahe\s+)?das\s+leben\s+genommen)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:bin|fühle\s+mich|war)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}suizidal|ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:habe|hab|hatte)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:suizidale|selbstmord)\s*gedanken|(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:habe|hab|hatte)|meine|mit|wegen)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:suizid|selbstmord|selbsttötungs)(?:gedanken|absichten|pläne)|ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}denke?\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}an\s+(?:selbstmord|suizid)|ich\s+bin\s+lebensmüde)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:ritz|ritze|schneid|schneide|verletz|verletze|verbrenn|verbrenne)\s+(?:mich|mir)\b|ich\s+(?:habe|hab)\s+mich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:geritzt|geschnitten)|mich\s+selbst\s+(?:verletze|verletzt|zu\s+verletzen)|mir\s+(?:in\s+den\s+arm|in\s+die\s+arme|die\s+haut|die\s+arme)\s+(?:schneiden|geschnitten|ritzen|geritzt|aufschneiden))\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:tue|tu|werde|will|möchte)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}mir\s+(?:weh|etwas\s+an|was\s+an)|ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,3}mir\s+(?:etwas|was)\s+an(?:zu)?tun)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:ich\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:will|möchte?|werde|würde)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}mit\s+allem\s+schluss\s+machen|mit\s+allem\s+schluss\s+(?:zu\s+)?machen)\b/i, category: 'self-harm-de' },
  { pattern: /\b(?:wie\s+viele?\s+[\wäöüßÄÖÜéèêàáíóúñçîï\s]{0,30}?\b(?:muss|müsste|braucht|bräuchte|sollte)\s+(?:ich|man)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:nehmen|schlucken|einnehmen)\b[^.!?\n]{0,20}\b(?:sterben|sterbe|stirbt|tot|tödlich)|(?:tödliche|letale)\s+(?:dosis|menge)|ab\s+(?:wie\s+vielen|welcher\s+(?:menge|dosis))\b[^.!?\n]{0,40}\b(?:tödlich|stirbt|sterben)|was\s+passiert\s+wenn\s+(?:ich|man)\s+\d+\s+\w*(?:tabletten|schlaftabletten|paracetamol|ibuprofen)|(?:schmerzlos|schmerzfrei|schnellste|einfachste)\w*\s+(?:art|weg|methode)\b[^.!?\n]{0,30}\b(?:sterben|umzubringen|umbringen)|wie\s+(?:töte|erhänge|vergifte|erschieße)\s+ich\s+mich|wie\s+\w+\s+man\s+sich\s+(?:am\s+(?:besten|schnellsten)\s+)?(?:um|umbringt|erhängt|vergiftet|tötet))\b/i, category: 'methods-de' },
  { pattern: /\b(?:(?:quiero|voy\s+a|pienso\s+en|estoy\s+pensando\s+en)\s+(?:morir(?:me)?|matarme|suicidarme|acabar\s+con\s+todo|quitarme\s+la\s+vida)|me\s+quiero\s+(?:morir|matar)|pienso\s+en\s+(?:el\s+)?suicidio)\b/i, category: 'self-harm-es' },
  { pattern: /\b(?:ya\s+)?no\s+quiero\s+(?:vivir|seguir\s+viviendo|seguir|estar\s+aqu[ií])\s*(?:m[áa]s)?\b/i, category: 'self-harm-es' },
  { pattern: /\b(?:estoy\s+harto\s+de\s+vivir|me\s+corto|me\s+hago\s+da[ñn]o|no\s+(?:vale|tiene)\s+la\s+pena\s+vivir)\b/i, category: 'self-harm-es' },
  { pattern: /\b(?:je\s+veux|j'?ai\s+envie\s+(?:de\s+|d')|je\s+vais|je\s+voudrais)\s*(?:mourir|me\s+tuer|me\s+suicider|en\s+finir|dispara[îi]tre|me\s+foutre\s+en\s+l'?air)\b/i, category: 'self-harm-fr' },
  { pattern: /\b(?:je\s+(?:ne\s+)?veux\s+plus\s+(?:vivre|être\s+l[àa]|continuer|me\s+réveiller)|je\s+pense\s+au\s+suicide|je\s+me\s+(?:coupe|scarifie|fais\s+du\s+mal)|j'?ai\s+des\s+id[ée]es\s+(?:noires|suicidaires)|je\s+suis\s+suicidaire)\b/i, category: 'self-harm-fr' },
];

const SOFT_DISTRESS_PATTERNS: Pattern[] = [
  { pattern: /\b(?:i\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:can'?t|cannot|cant)\s+(?:do|take|handle|bear|stand)\s+(?:this|it|life)\s*(?:any\s*more|anymore|any\s+longer)?|i\s+(?:can'?t|cannot|cant)\s+go\s+on|i\s+(?:just\s+)?want\s+(?:it|everything|the\s+pain|this)\s+to\s+(?:stop|end|be\s+over)|i\s+want\s+out\s+of\s+(?:this|my)\s+life)\b/i, category: 'distress' },
  { pattern: /\b(?:what'?s\s+the\s+point\s+(?:of\s+(?:anything|any\s+of\s+(?:it|this)|living|going\s+on|it\s+all)|any\s*more)|everything\s+(?:feels|seems|is)\s+(?:so\s+)?(?:pointless|hopeless|meaningless|empty)|at\s+the\s+end\s+of\s+my\s+rope|life\s+(?:isn'?t|is\s+not|isnt)\s+worth\s+living|there(?:'?s|\s+is)\s+no\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|go(?:ing)?\s+on)\b(?!\s+for\s+(?:tomorrow|the|a\b)))/i, category: 'distress' },
  { pattern: /\b(?:i\s+feel\s+(?:so\s+|completely\s+|totally\s+)?(?:hopeless|worthless|like\s+giving\s+up|like\s+a\s+burden)|i\s*(?:a?m|'m)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}a\s+burden|i\s+wish\s+i\s+(?:had\s+never|was\s+never|were\s+never|'?d\s+never)\s+been\s+born|(?:everyone|everybody|they|the\s+world|my\s+family|people)\s+(?:would|'?d)\s+be\s+better\s+off\s+without\s+me|(?:nobody|no\s+one)\s+would\s+(?:miss|notice|care)\b[^.!?\n]{0,25}\b(?:me|if\s+i\s+(?:was|were|disappeared|died|left))|i\s+(?:have|'?ve\s+got|got)\s+a\s+plan\s+and\s+a\s+date|i\s+wrote\s+(?:my|a)\s+(?:suicide\s+)?note)\b/i, category: 'distress' },
  { pattern: /\b(?:ich\s+kann\s+(?:einfach\s+|so\s+)?nicht\s+mehr|ich\s+(?:halte|halt)\s+(?:das|es)\s+(?:alles\s+)?nicht\s+mehr\s+aus|ich\s+(?:pack|packe|schaff|schaffe)\s+(?:das|es)\s+(?:alles\s+)?(?:einfach\s+)?nicht\s+mehr|ich\s+will\s+(?:einfach\s+)?nicht\s+mehr\s*(?:[.!…]|,\s*wirklich|weiter(?:machen)?\s*[.!…]*\s*$))/i, category: 'distress-de' },
  { pattern: /^\s*ich\s+(?:will|mag)\s+(?:einfach\s+)?nicht\s+mehr\s*[.!…]*\s*$/i, category: 'distress-de' },
  { pattern: /\b(?:ich\s+(?:bin|fühle\s+mich)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:hoffnungslos|wertlos|am\s+ende|allen\s+eine\s+last|eine\s+last\s+für\s+alle)|es\s+soll\s+(?:einfach\s+|endlich\s+)?(?:aufhören|vorbei\s+sein)|was\s+soll\s+das\s+(?:alles\s+)?noch|lebensmüde|ich\s+denke?\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}(?:ans|an\s+das|über\s+das)\s+sterben)\b/i, category: 'distress-de' },
  { pattern: /\b(?:(?:es|alles|das\s+alles|das\s+leben|mein\s+leben)\s+(?:hat|macht)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}keinen\s+sinn\s+mehr|ohne\s+mich\s+(?:wäre|wär|ist|wären|geht)\s+(?:es|alles|die\s+welt|allen|ihr|alle)\s+(?:[\wäöüßÄÖÜéèêàáíóúñçîï]+\s+){0,2}besser|(?:niemand|keiner)\s+(?:würde|wird)\s+mich\s+vermissen)\b/i, category: 'distress-de' },
  { pattern: /\b(?:(?:ya\s+)?no\s+(?:aguanto|puedo)\s+m[áa]s)\b/i, category: 'distress-es' },
  { pattern: /\b(?:je\s+n'?en\s+peux\s+plus|j'?en\s+ai\s+marre\s+de\s+(?:tout|vivre)|je\s+(?:ne\s+)?tiens\s+plus)\b/i, category: 'distress-fr' },
];

const TOPICAL_PATTERNS: Pattern[] = [
  { pattern: /\b(?:suicid\w*|self[\s-]?harm\w*|(?:kill(?:ed|s|ing)?|drown(?:ed|s|ing)?|hang(?:ed|s|ing)?)\s+(?:him|her|them)sel(?:f|ves)|took\s+(?:his|her|their|its)\s+own\s+life|end(?:ed|ing|s)?\s+(?:his|her|their)\s+(?:own\s+)?life|euthanas\w*|assisted\s+dying)\b/i, category: 'topical' },
  { pattern: /\b(?:Suizid\w*|Selbstmord\w*|Selbstt[öo]tung\w*|Freitod|sich\s+(?:das\s+Leben\s+)?(?:genommen|umgebracht|umbrachte|nahm)|Sterbehilfe|Selbstverletzung\w*)\b/i, category: 'topical-de' },
  { pattern: /\b(?:suicid\w*|autolesi\w*|quitarse\s+la\s+vida|eutanasia)\b/i, category: 'topical-es' },
  { pattern: /\b(?:suicid\w*|automutilation|s'?est\s+donn[ée]\s+la\s+mort|euthanasie)\b/i, category: 'topical-fr' },
];

const POLICY_PATTERNS: Array<{ pattern: RegExp; category: string; responseType: BlockResponseType }> = [
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

export type ScreenTier = 'block' | 'distress' | 'topical' | 'none';

export type SafetyScreenResult =
  | { safe: true; tier: Exclude<ScreenTier, 'block'> }
  | { safe: false; tier: 'block'; category: string; responseType: BlockResponseType; crisisResources: CrisisResources };

export interface Helpline {
  name: string;
  contact: string;
  description: { en: string; de: string };
  /** ISO country codes this line serves; empty means everywhere. */
  countries: string[];
}

export interface CrisisResources {
  message: { en: string; de: string };
  resources: Helpline[];
}

/**
 * One list, rendered client side, ordered by where the visitor is. The worker
 * only ever sends a country code, never a number.
 */
const HELPLINES: Helpline[] = [
  {
    name: 'Telefonseelsorge',
    contact: '0800 111 0 111 / 0800 111 0 222',
    description: { en: 'Any hour, free, anonymous (Germany)', de: 'Rund um die Uhr, kostenlos, anonym (Deutschland)' },
    countries: ['DE'],
  },
  {
    name: 'Kinder- und Jugendtelefon',
    contact: '116 111',
    description: { en: 'For children and young people (Germany)', de: 'Für Kinder und Jugendliche (Deutschland)' },
    countries: ['DE'],
  },
  {
    name: 'Telefonseelsorge Österreich',
    contact: '142',
    description: { en: 'Any hour, free (Austria)', de: 'Rund um die Uhr, kostenlos (Österreich)' },
    countries: ['AT'],
  },
  {
    name: 'Die Dargebotene Hand',
    contact: '143',
    description: { en: 'Any hour, free (Switzerland)', de: 'Rund um die Uhr, kostenlos (Schweiz)' },
    countries: ['CH'],
  },
  {
    name: '988 Suicide and Crisis Lifeline',
    contact: '988',
    description: { en: 'Call or text 988 (USA)', de: 'Anruf oder SMS an 988 (USA)' },
    countries: ['US'],
  },
  {
    name: 'Samaritans',
    contact: '116 123',
    description: { en: 'Any hour, free (UK and Ireland)', de: 'Rund um die Uhr, kostenlos (UK und Irland)' },
    countries: ['GB', 'IE'],
  },
  {
    name: 'International Association for Suicide Prevention',
    contact: 'https://www.iasp.info/resources/Crisis_Centres/',
    description: { en: 'Find your local crisis centre', de: 'Finde dein lokales Krisenzentrum' },
    countries: [],
  },
];

/**
 * Helplines for a country first, then the ones that reach everyone. An
 * unknown country gets Germany first, since that is where most visitors are.
 */
export function getHelplines(country?: string | null): Helpline[] {
  const code = (country || '').toUpperCase();
  const local = HELPLINES.filter(h => h.countries.includes(code));
  const everywhere = HELPLINES.filter(h => h.countries.length === 0);
  const fallback = local.length ? [] : HELPLINES.filter(h => h.countries.includes('DE'));
  return [...local, ...fallback, ...everywhere];
}

/** Country from the browser locale, the best guess the client has on its own. */
export function guessCountry(): string | null {
  const locale = typeof navigator !== 'undefined' ? navigator.language : '';
  const region = locale.split('-')[1];
  return region && region.length === 2 ? region.toUpperCase() : null;
}

const CRISIS_RESOURCES: CrisisResources = {
  message: {
    en: 'What you wrote matters, and it is more than a conversation here can hold. Please talk to someone today. You are welcome back here whenever you want.',
    de: 'Was du geschrieben hast, zählt, und es ist mehr, als ein Gespräch hier tragen kann. Bitte sprich heute mit jemandem. Du bist hier jederzeit wieder willkommen.',
  },
  resources: getHelplines(guessCountry()),
};

/**
 * Screen user-submitted text. A first-person statement about the visitor's own
 * safety, and every policy match, is unsafe and stops the send. Soft distress
 * and topical mentions are safe to send: the worker attaches resources and, for
 * distress, forces the crisis rules into the prompt.
 */
export function screenContent(text: string): SafetyScreenResult {
  const normalized = text.trim();
  if (!normalized) return { safe: true, tier: 'none' };

  for (const { pattern, category, responseType } of POLICY_PATTERNS) {
    if (pattern.test(normalized)) {
      return { safe: false, tier: 'block', category, responseType, crisisResources: CRISIS_RESOURCES };
    }
  }
  for (const { pattern, category } of FIRST_PERSON_PATTERNS) {
    if (pattern.test(normalized)) {
      return { safe: false, tier: 'block', category, responseType: 'crisis', crisisResources: CRISIS_RESOURCES };
    }
  }
  for (const { pattern } of SOFT_DISTRESS_PATTERNS) {
    if (pattern.test(normalized)) return { safe: true, tier: 'distress' };
  }
  for (const { pattern } of TOPICAL_PATTERNS) {
    if (pattern.test(normalized)) return { safe: true, tier: 'topical' };
  }
  return { safe: true, tier: 'none' };
}

/**
 * Get crisis resources (for displaying independently of screening).
 */
export function getCrisisResources(): CrisisResources {
  return CRISIS_RESOURCES;
}
