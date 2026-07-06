export const domains = ["terms"] as const;

export type Domain = (typeof domains)[number];
