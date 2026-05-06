// client/src/services/llm/questTools.ts
// Tool definition for quest verdict via function calling.
// Used by challenge mode to get structured pass/fail from the LLM.

export interface AwardSeedArgs {
  passed: boolean;
  seedTitle: string;
}

export interface ToolCallResult {
  name: string;
  arguments: string; // raw JSON string
  id?: string;
}

/** OpenAI-compatible tool definition for award_seed */
export const QUEST_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'award_seed',
      description:
        'Award or deny a seed to the seeker based on their demonstrated understanding during the quest examination. Call this after delivering your spoken verdict.',
      parameters: {
        type: 'object',
        properties: {
          passed: {
            type: 'boolean',
            description:
              'true if the seeker demonstrated genuine understanding, false otherwise',
          },
          seedTitle: {
            type: 'string',
            description: 'The exact title of the seed being examined',
          },
        },
        required: ['passed', 'seedTitle'],
      },
    },
  },
];
