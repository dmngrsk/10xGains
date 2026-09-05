/*
 * Custom service worker: `ngsw-worker.js` is a build artifact and cannot be edited, so the one
 * thing it cannot do is layered on here and the Angular worker imported underneath, unchanged.
 *
 * That one thing is the notification's "Complete set" action. ngsw's only network operation is
 * `sendRequest`, a bare GET whose response is discarded, and completing a set is a PATCH carrying a
 * session action token.
 *
 * Being plain JavaScript outside the Angular build, this file cannot read `environment` or import
 * from the app; everything it needs travels in the notification's `data`.
 */

const COMPLETE_SET_ACTION = 'complete-set';
const NOTIFICATION_TAG = 'active-session';
const NOTIFICATION_BADGE = '/assets/favicon/notification-badge.png';

/*
 * Registered before ngsw is imported so it runs first, though ngsw's handler still closes the
 * notification afterwards - which is why every path below re-shows rather than updating in place.
 */
self.addEventListener('notificationclick', event => {
  if (event.action !== COMPLETE_SET_ACTION) {
    return;
  }

  event.waitUntil(completeSet(event.notification.data));
});

importScripts('./ngsw-worker.js');

/**
 * Mirrors `session-notification.utils.ts`, which is canonical and carries the tests. A service
 * worker cannot import from the app bundle, so the duplication is unavoidable.
 */
function describeSet(nextSet) {
  const reps = `${nextSet.expected_reps} reps`;
  const description = nextSet.expected_weight ? `${reps} @ ${nextSet.expected_weight} kg` : reps;
  return {
    title: nextSet.exercise_name,
    body: `Set ${nextSet.set_number}/${nextSet.set_count} · ${description}`,
  };
}

function show(content, data, includeCompleteAction) {
  const actions = [{ action: 'open', title: 'Open' }];
  if (includeCompleteAction) {
    actions.unshift({ action: COMPLETE_SET_ACTION, title: 'Complete set' });
  }

  return self.registration.showNotification(content.title, {
    body: content.body,
    tag: NOTIFICATION_TAG,
    badge: NOTIFICATION_BADGE,
    silent: true,
    requireInteraction: true,
    actions,
    data,
  });
}

async function completeSet(data) {
  if (!data || !data.apiBaseUrl || !data.token || !data.setId || !data.sessionId) {
    return;
  }

  // ngsw has already closed the notification, so this stands in while the request is on the wire.
  await show({ title: data.title, body: 'Saving…' }, data, false);

  let response;
  try {
    response = await fetch(
      `${data.apiBaseUrl}/sessions/${data.sessionId}/sets/${data.setId}/complete-with-token`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
      }
    );
  } catch {
    // Offline, most likely. Nothing was recorded, and the token is still good, so say so and
    // leave the action in place.
    await show({ title: data.title, body: "Couldn't save - tap to open" }, data, true);
    return;
  }

  // Spent token, finished session, or missing set: none retryable, so the notification goes away
  // rather than misleading the user.
  if (!response.ok) {
    return;
  }

  const body = await response.json().catch(() => null);
  const nextSet = body && body.data ? body.data.next_set : null;

  if (!nextSet) {
    await show(
      { title: 'Workout in progress', body: 'All sets done - tap to finish' },
      { ...data, setId: null, title: 'Workout in progress' },
      false
    );
    return;
  }

  const content = describeSet(nextSet);
  await show(content, { ...data, setId: nextSet.id, title: content.title }, true);
}
