import coreWorker from './index.js';
import { handlePerformanceDashboard, handlePerformanceSnapshot } from './performance-dashboard-v2.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/visuals/api/performance') {
      return handlePerformanceSnapshot(request, env);
    }

    if (url.pathname === '/sowhat-performance-dashboard') {
      return handlePerformanceDashboard(request, env);
    }

    return coreWorker.fetch(request, env, ctx);
  },
};
