// Search phrases come from a model; the link is always built here so it can only ever be a Google search.
export const withNearMe = (phrase: string): string => {
  const tidy = phrase.trim().replace(/\s+/g, ' ');
  return /near me$/i.test(tidy) ? tidy : `${tidy} near me`;
};

export const googleSearchUrl = (phrase: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(phrase.trim())}`;
