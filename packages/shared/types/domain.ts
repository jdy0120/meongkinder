export const domains = [] as const;

export type Domain = (typeof domains)[number];
