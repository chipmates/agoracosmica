// GET /health — public health check

export function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'agora-cosmica-llm',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
