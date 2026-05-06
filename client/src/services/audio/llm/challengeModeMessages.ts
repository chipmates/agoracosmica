/**
 * challengeModeMessages.ts
 * Messages for the Challenge mode with all content in the target language
 *
 * NOTE (October 16, 2025): These are now FALLBACK ONLY
 * - Pre-created Quest messages used for all 30 figures (seeds 1-12)
 * - These prompts only used if:
 *   - Seed >12 (no pre-created message)
 *   - Language not EN/DE (no pre-created message)
 *   - Initial message load fails
 *
 * V3 UPDATE (March 2026): Simplified — verdict handling moved to tool calling
 * (award_seed tool). No emoji format instructions needed. Three questions, not five.
 *
 * See: client/src/services/audio/initialMessageService.ts for primary system
 */

export const challengeModeMessages: Record<string, string> = {
  en: "I seek to be tested on my understanding of {SEED_TITLE}. Please ask me one question at a time and wait for my complete answer before proceeding. After your three questions, call the award_seed tool with your verdict.",

  de: "Ich möchte mein Verständnis von {SEED_TITLE} prüfen lassen. Bitte stelle mir nur eine Frage auf einmal und warte auf meine vollständige Antwort. Rufe nach deinen drei Fragen das award_seed Tool mit deinem Urteil auf.",

  fr: "Je souhaite être évalué sur ma compréhension de {SEED_TITLE}. Veuillez me poser une seule question à la fois et attendre ma réponse complète. Après vos trois questions, appelez l'outil award_seed avec votre verdict.",

  es: "Deseo que evalúes mi comprensión de {SEED_TITLE}. Por favor, hazme una sola pregunta a la vez y espera mi respuesta completa. Después de tus tres preguntas, llama a la herramienta award_seed con tu veredicto.",

  pt: "Gostaria de ser avaliado sobre meu entendimento de {SEED_TITLE}. Por favor, faça-me apenas uma pergunta de cada vez e aguarde minha resposta completa. Após suas três perguntas, chame a ferramenta award_seed com seu veredito.",

  it: "Vorrei essere valutato sulla mia comprensione di {SEED_TITLE}. Ti prego di pormi una sola domanda alla volta e attendere la mia risposta completa. Dopo le tue tre domande, chiama lo strumento award_seed con il tuo verdetto.",

  ru: "Я хочу проверить своё понимание {SEED_TITLE}. Пожалуйста, задавайте мне только один вопрос за раз и ждите моего полного ответа. После трёх вопросов вызовите инструмент award_seed с вашим вердиктом.",

  zh: "我希望测试我对{SEED_TITLE}的理解。请每次只提一个问题，并在进行下一个问题之前等待我的完整回答。三个问题之后，请调用award_seed工具给出你的评判。",

  ja: "{SEED_TITLE}についての理解度を試してください。一度に一つの質問だけをして、次の質問に進む前に私の完全な回答を待ってください。三つの質問の後、award_seedツールであなたの判定を呼び出してください。",

  ar: "أرغب في اختبار فهمي لـ {SEED_TITLE}. يرجى طرح سؤال واحد فقط في كل مرة، وانتظر إجابتي الكاملة قبل الانتقال إلى السؤال التالي. بعد أسئلتك الثلاثة، استدعِ أداة award_seed مع حكمك.",

  tr: "{SEED_TITLE} hakkındaki anlayışımın test edilmesini istiyorum. Lütfen bir seferde sadece bir soru sorun ve bir sonraki soruya geçmeden önce benim tam cevabımı bekleyin. Üç sorunuzdan sonra, award_seed aracını kararınızla çağırın."
};
