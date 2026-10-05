// An unpaired surrogate makes encodeURIComponent throw, so it is removed; a valid pair (an emoji) is kept.
// No lookbehind: this file is in the client auto-import folder, and Safari before 16.4 cannot parse a regex with one. A valid pair matches the first branch and is kept; anything else in the surrogate range is a lone one and is dropped.
const dropLoneSurrogates = (text: string): string =>
  text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (match) => (match.length === 2 ? match : ''));

// Search phrases come from a model; the link is always built here so it can only ever be a Google search.
export const withNearMe = (phrase: string): string => {
  const tidy = dropLoneSurrogates(phrase).trim().replace(/\s+/g, ' ');
  return /near me$/i.test(tidy) ? tidy : `${tidy} near me`;
};

// Also cleans, so a phrase saved before the fix can never make a read throw.
export const googleSearchUrl = (phrase: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent(dropLoneSurrogates(phrase).trim())}`;
