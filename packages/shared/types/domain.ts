export const domains = ["terms", "daily-report", "feed", "pet"] as const;

export type Domain = (typeof domains)[number];
