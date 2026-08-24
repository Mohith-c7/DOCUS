export async function register() {
  const isServerless = process.env.NETLIFY === 'true' || process.env.VERCEL === 'true' || !process.env.REDIS_HOST;
  if (!isServerless && process.env.NEXT_RUNTIME === 'nodejs' && process.env.DISABLE_INLINE_WORKER !== 'true') {
    try {
      const { worker } = await import('./modules/processing/queue');
      void worker;
      console.log('Instrumentation: Background task queue worker initialized successfully.');
    } catch (err) {
      console.warn('Instrumentation: Queue worker initialization skipped:', err);
    }
  }
}
