// A short summary of the care plan (not the answers) that is sent when a plan is saved,
// so the dashboard can show totals such as "how many plans were urgent".
export function outcomeSummary(P) {
  return {
    urgency: P.urgency.level,
    flags: Object.keys(P.F).filter((k) => P.F[k].on && k !== 'F-MOODRISK'), // mood answers never go into statistics
    who: P.who.map((w) => w.cat),
    tests: P.tests.map((t) => t.id),
    safety: P.banners.map((b) => b.code).filter((c) => c !== 'mood'),
  };
}
