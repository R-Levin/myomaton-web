// One fixed composite Hero reservation, never a customer-authored timeline.
export const heroMotion = {
  eyebrow: { duration: 360, travel: 8 },
  heading: { duration: 1150, travel: 96, mobileTravel: 56 },
  support: { duration: 650, travel: 24 },
  action: { duration: 450, travel: 18 },
  supportDelay: 100,
  actionDelay: 160,
  easing: "cubic-bezier(.22,.6,.35,1)",
} as const;

export function heroSequence(hasHeading: boolean, hasSupport: boolean, hasAction: boolean) {
  const supportStart = hasHeading ? heroMotion.supportDelay : 0;
  const actionStart = hasSupport ? supportStart + heroMotion.actionDelay : hasHeading ? heroMotion.actionDelay : 0;
  return {
    supportStart,
    actionStart,
    duration: Math.max(hasHeading ? heroMotion.heading.duration : 0,
      hasSupport ? supportStart + heroMotion.support.duration : 0,
      hasAction ? actionStart + heroMotion.action.duration : 0),
  };
}

// Visible-entry events wait for CSS Hero reservations and for one another.
// Animation objects are supplied by the browser; failures never hide content.
type MotionCompletion = { finished: Promise<unknown> };
export async function serializeMotionEvents(events: MotionCompletion[], start: () => MotionCompletion | undefined, stopped: () => boolean) {
  await Promise.all(events.map(event => event.finished.catch(() => undefined)));
  if (stopped()) return;
  const animation = start();
  if (animation) await animation.finished.catch(() => undefined);
}
