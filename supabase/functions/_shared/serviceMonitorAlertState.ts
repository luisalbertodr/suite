export type MonitorServiceStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export type AlertThresholds = {
  failures_before_alert: number;
  successes_before_recovery: number;
};

export type AlertEvaluation = {
  details: Record<string, unknown>;
  notifyDown: boolean;
  notifyRecovery: boolean;
  notifyDegraded: boolean;
  failureStreak: number;
  okStreak: number;
  alertActive: boolean;
};

/** Actualiza rachas y decide si toca avisar (con histéresis anti-flapping). */
export function evaluateServiceAlerts(
  resultStatus: MonitorServiceStatus,
  details: Record<string, unknown>,
  thresholds: AlertThresholds,
): AlertEvaluation {
  const failuresBefore = Math.max(1, thresholds.failures_before_alert ?? 2);
  const successesBefore = Math.max(1, thresholds.successes_before_recovery ?? 3);

  const prevFailureStreak =
    Number(details.failure_streak ?? details.consecutive_failures ?? 0) || 0;
  const prevOkStreak = Number(details.consecutive_ok ?? 0) || 0;
  const alertActive = details.alert_active === true;

  let failureStreak = prevFailureStreak;
  let okStreak = prevOkStreak;

  if (resultStatus === 'ok') {
    okStreak = prevOkStreak + 1;
    failureStreak = 0;
  } else if (resultStatus === 'down' || resultStatus === 'degraded') {
    failureStreak = prevFailureStreak + 1;
    okStreak = 0;
  } else {
    okStreak = 0;
  }

  let notifyDown = false;
  let notifyRecovery = false;
  let notifyDegraded = false;

  if (resultStatus === 'down' && failureStreak >= failuresBefore && !alertActive) {
    notifyDown = true;
  }
  if (resultStatus === 'degraded' && failureStreak >= failuresBefore && !alertActive) {
    notifyDegraded = true;
  }
  if (resultStatus === 'ok' && alertActive && okStreak >= successesBefore) {
    notifyRecovery = true;
  }

  const newDetails: Record<string, unknown> = {
    ...details,
    failure_streak: failureStreak,
    consecutive_failures: failureStreak,
    consecutive_ok: okStreak,
    alert_active: alertActive,
  };

  return {
    details: newDetails,
    notifyDown,
    notifyRecovery,
    notifyDegraded,
    failureStreak,
    okStreak,
    alertActive,
  };
}

export function markAlertDown(details: Record<string, unknown>): Record<string, unknown> {
  return { ...details, alert_active: true };
}

export function markAlertRecovered(details: Record<string, unknown>): Record<string, unknown> {
  return {
    ...details,
    alert_active: false,
    failure_streak: 0,
    consecutive_failures: 0,
    consecutive_ok: 0,
  };
}
