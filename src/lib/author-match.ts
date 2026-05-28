/** 記事の対象作家名と Amazon API の著者名が同一人物か判定する */

export function normalizeAuthorName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/國/g, '国')
    .toLowerCase();
}

function splitAuthorNames(productAuthor: string): string[] {
  return productAuthor
    .split(/[,、・／/|]/)
    .map((part) => normalizeAuthorName(part.trim()))
    .filter((part) => part.length > 0);
}

export function isMatchingAuthor(
  expectedAuthor: string,
  productAuthor: string | undefined
): boolean {
  if (!productAuthor?.trim()) return false;

  const expected = normalizeAuthorName(expectedAuthor);
  const candidates = splitAuthorNames(productAuthor);

  return candidates.some(
    (actual) =>
      actual.includes(expected) ||
      expected.includes(actual) ||
      (expected.length >= 2 &&
        actual.length >= 2 &&
        expected.slice(0, 2) === actual.slice(0, 2) &&
        (expected.includes(actual.slice(-2)) || actual.includes(expected.slice(-2))))
  );
}
