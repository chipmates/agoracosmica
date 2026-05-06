/**
 * freeConversationMessages.ts
 * Messages for Free Conversation mode
 *
 * NOTE (October 16, 2025): These are now FALLBACK ONLY
 * - Pre-created initial messages (FreeTalk greetings) used for all 30 figures
 * - These prompts only used if initial message load fails
 *
 * See: client/src/services/audio/initialMessageService.ts for primary system
 */

export const freeConversationMessages: Record<string, string> = {
  en: "Hello there! I'd like to have an open-ended chat with you about any topic. Please start with a concise reply, and if I want more depth, I'll let you know.",
  
  de: "Hallo! Ich möchte ein offenes Gespräch mit dir über jedes beliebige Thema führen. Bitte beginne mit einer kurzen Antwort, und wenn ich mehr Details möchte, sage ich Bescheid.",
  
  es: "¡Hola! Me gustaría tener una conversación abierta contigo sobre cualquier tema. Comienza con una respuesta breve y, si quiero mayor profundidad, te lo haré saber.",
  
  zh: "你好！我想和你随便聊聊任何话题。请先简短回答，如果我想了解更多细节，会再告诉你。",
  
  fr: "Bonjour ! J'aimerais entamer un échange libre avec toi sur n'importe quel sujet. Commence par une réponse concise, et si je souhaite davantage de détails, je te le dirai.",
  
  ar: "مرحباً! أحب أن أجري معك حواراً مفتوحاً حول أي موضوع. أجب بإيجاز في البداية، وإذا رغبتُ في مزيد من التفاصيل، سأخبرك.",
  
  pt: "Olá! Gostaria de ter uma conversa aberta contigo sobre qualquer assunto. Por favor, responda de forma concisa primeiro e, se eu quiser mais detalhes, avisarei.",
  
  ru: "Здравствуйте! Я хочу вести с вами свободную беседу на любую тему. Начните, пожалуйста, с краткого ответа, а если мне потребуется больше подробностей, я сообщу.",
  
  ja: "こんにちは！どんな話題でも自由にお話ししたいです。まずは簡潔に答えていただき、詳しく知りたければお伝えしますね。",
  
  it: "Ciao! Vorrei iniziare una conversazione aperta con te su qualsiasi argomento. Inizia con una risposta concisa, e se desidero più dettagli, te lo farò sapere.",
  
  tr: "Merhaba! Seninle her konuda açık bir sohbet yapmak istiyorum. Lütfen önce kısa bir cevap ver, daha fazla ayrıntı istersem sana söyleyeceğim.",
  
  bg: "Здравей! Бих искал да проведем открит разговор на всякаква тема. Моля, започни с кратък отговор, а ако имам нужда от повече подробности, ще ти кажа."
};