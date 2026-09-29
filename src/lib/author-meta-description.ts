import { cleanBookTitleForSearch } from './book-format';

const META_DESCRIPTION_MAX = 155;
const META_DESCRIPTION_TARGET_MIN = 100;

const AUTHOR_SUFFIXES = [
  'など、複数のWeb記事で紹介された代表作・人気作を、言及頻度の高い順におすすめランキング。',
  'など、Web記事で紹介された代表作を言及頻度順にランキング。',
  'など代表作を、言及頻度順のおすすめランキング。',
] as const;
const AUTHOR_FALLBACK_SUFFIX =
  'Web記事で紹介された人気作・代表作を、言及頻度の高い順におすすめランキング。';

export function cleanBookTitleForMetaDescription(title: string): string {
  return cleanBookTitleForSearch(title)
    .replace(/[「」『』]/g, '')
    .trim();
}

function formatQuotedTitles(titles: string[]): string {
  return titles.map((title) => `『${title}』`).join('');
}

function buildAuthorPrefix(authorName: string): string {
  return `${authorName}のおすすめ作品・代表作ランキング。`;
}

export function buildAuthorMetaDescription(
  authorName: string,
  bookTitles: string[]
): string {
  const titles = bookTitles
    .map(cleanBookTitleForMetaDescription)
    .filter((title) => title.length > 0);

  const prefix = buildAuthorPrefix(authorName);

  if (titles.length === 0) {
    return `${prefix}${AUTHOR_FALLBACK_SUFFIX}`;
  }

  let best = `${prefix}${AUTHOR_FALLBACK_SUFFIX}`;
  let bestScore = -1;

  for (let count = 1; count <= Math.min(titles.length, 5); count++) {
    const works = formatQuotedTitles(titles.slice(0, count));

    for (const suffix of AUTHOR_SUFFIXES) {
      const candidate = `${prefix}${works}${suffix}`;
      if (candidate.length > META_DESCRIPTION_MAX) continue;

      const score =
        (candidate.length >= META_DESCRIPTION_TARGET_MIN ? 1000 : 0) +
        candidate.length +
        count * 10;

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return best;
}
