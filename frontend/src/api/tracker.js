import api from './client';

let lastPage = null;
let pageEnterTime = null;

// Track page view
export function trackPageView(page) {
  const now = Date.now();
  const duration = lastPage && pageEnterTime ? Math.round((now - pageEnterTime) / 1000) : null;

  api.post('/activity/log', {
    action: 'page_view',
    details: {
      page,
      previous_page: lastPage,
      duration_seconds: duration,
    },
  }).catch(() => {}); // Silent fail

  lastPage = page;
  pageEnterTime = now;
}

// Track user action
export function trackAction(action, details = {}) {
  api.post('/activity/log', {
    action,
    details,
  }).catch(() => {});
}

// Track logout
export function trackLogout() {
  return api.post('/auth/logout').catch(() => {});
}
