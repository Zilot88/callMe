const DIAGNOSTICS_ENDPOINT = '/api/diagnostics';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem('diag_session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('diag_session_id', id);
  }
  return id;
}

export interface DiagnosticEvent {
  eventType: string;
  details: string;
  error?: string;
  iceConfig?: string;
}

export function reportDiagnostic(event: DiagnosticEvent): void {
  try {
    const payload = JSON.stringify({
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...event,
    });

    // sendBeacon works even when the page is closing
    const sent = navigator.sendBeacon?.(
      DIAGNOSTICS_ENDPOINT,
      new Blob([payload], { type: 'application/json' }),
    );

    if (!sent) {
      fetch(DIAGNOSTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // silently ignore - diagnostics must never break the app
      });
    }
  } catch {
    // silently ignore
  }
}
