export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { worker } = await import('./modules/processing/queue');
    void worker;
    console.log('Instrumentation: Background task queue worker initialized successfully.');
  }
}
