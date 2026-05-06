/**
 * seedConversationMessages.ts
 * Messages for Seed Conversation mode
 *
 * NOTE (October 16, 2025): These are now FALLBACK ONLY
 * - Pre-created initial messages are used for all 30 figures (seeds 1-12)
 * - These prompts only used if:
 *   - Seed >12 (no pre-created message)
 *   - Language not EN/DE (no pre-created message)
 *   - Initial message load fails (Cloudflare down)
 *
 * See: client/src/services/audio/initialMessageService.ts for primary system
 */

export const seedConversationMessages: Record<string, string> = {
  en: "Hello. Can you share in 2 to 3 sentences a deep novel thought about the teaching. Then mention {SEED_TITLE} in a way that opens dialogue. Keep it brief and conversational - let the teaching emerge through discussion, not exposition.",
  
  de: "Hallo. Kannst du in 2 bis 3 Sätzen einen tiefen, neuartigen Gedanken über die Lehre teilen. Erwähne dann {SEED_TITLE} auf eine Weise, die zum Dialog einlädt. Halte es kurz und gesprächig - lass die Lehre durch Diskussion entstehen, nicht durch Darlegung.",
  
  es: "Hola. ¿Puedes compartir en 2 o 3 oraciones un pensamiento profundo y novedoso sobre la enseñanza? Luego menciona {SEED_TITLE} de manera que abra el diálogo. Mantenlo breve y conversacional - deja que la enseñanza surja a través de la discusión, no de la exposición.",
  
  zh: "你好。你能用2到3句话分享一个关于教导的深刻新颖的想法吗？然后以开启对话的方式提及{SEED_TITLE}。保持简短和对话式 - 让教导通过讨论而非阐述自然呈现。",
  
  fr: "Bonjour. Peux-tu partager en 2 à 3 phrases une pensée profonde et nouvelle sur l'enseignement. Puis mentionne {SEED_TITLE} d'une manière qui ouvre le dialogue. Reste bref et conversationnel - laisse l'enseignement émerger par la discussion, pas par l'exposition.",
  
  ar: "مرحبا. هل يمكنك مشاركة فكرة عميقة وجديدة حول التعليم في 2 إلى 3 جمل. ثم اذكر {SEED_TITLE} بطريقة تفتح الحوار. اجعلها موجزة ومحادثة - دع التعليم ينبثق من خلال النقاش وليس العرض.",
  
  pt: "Olá. Você pode compartilhar em 2 a 3 frases um pensamento profundo e inovador sobre o ensinamento. Depois mencione {SEED_TITLE} de uma forma que abra o diálogo. Mantenha breve e conversacional - deixe o ensinamento emergir através da discussão, não da exposição.",
  
  ru: "Привет. Можешь поделиться в 2-3 предложениях глубокой новой мыслью об учении. Затем упомяни {SEED_TITLE} так, чтобы открыть диалог. Будь кратким и разговорным - пусть учение проявится через обсуждение, а не изложение.",
  
  ja: "こんにちは。教えについて深く新しい考えを2〜3文で共有してください。次に、対話を開く方法で{SEED_TITLE}に言及してください。簡潔で会話的に - 説明ではなく議論を通じて教えを生まれさせてください。",
  
  it: "Ciao. Puoi condividere in 2 o 3 frasi un pensiero profondo e innovativo sull'insegnamento. Poi menziona {SEED_TITLE} in modo da aprire il dialogo. Mantieni breve e conversazionale - lascia che l'insegnamento emerga attraverso la discussione, non l'esposizione.",
  
  tr: "Merhaba. Öğreti hakkında 2 ila 3 cümlede derin ve yeni bir düşünce paylaşabilir misin. Sonra {SEED_TITLE} konusunu diyaloğu açacak şekilde bahset. Kısa ve sohbet havasında tut - öğretinin açıklama değil, tartışma yoluyla ortaya çıkmasına izin ver.",
  
  bg: "Здравей. Можеш ли да споделиш в 2 до 3 изречения дълбока нова мисъл за учението. След това спомени {SEED_TITLE} по начин, който отваря диалог. Дръж го кратко и разговорно - нека учението да се появи чрез дискусия, а не изложение."
};