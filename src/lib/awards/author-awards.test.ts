import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAuthorAwardsIndex,
  clearAuthorAwardsIndexCache,
  getAuthorAwardLinks,
  getAuthorAwards,
} from './author-awards';

describe('getAuthorAwards', () => {
  it('returns wins for a known Akutagawa winner', () => {
    clearAuthorAwardsIndexCache();
    const wins = getAuthorAwards('石川達三');
    assert.ok(wins.length >= 1);
    assert.ok(wins.some((w) => w.awardSlug === 'akutagawa' && w.workTitle.includes('蒼氓')));
  });

  it('returns empty for unknown author', () => {
    clearAuthorAwardsIndexCache();
    assert.deepEqual(getAuthorAwards('存在しない作家名'), []);
  });

  it('sorts by session descending', () => {
    clearAuthorAwardsIndexCache();
    const wins = getAuthorAwards('村上春樹');
    if (wins.length < 2) return;
    for (let i = 1; i < wins.length; i++) {
      assert.ok(wins[i - 1].session >= wins[i].session);
    }
  });
});

describe('getAuthorAwardLinks', () => {
  it('deduplicates award slugs', () => {
    const wins = getAuthorAwards('石川達三');
    const links = getAuthorAwardLinks(wins);
    const slugs = links.map((l) => l.awardSlug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
});

describe('buildAuthorAwardsIndex', () => {
  it('indexes multiple authors', () => {
    clearAuthorAwardsIndexCache();
    const index = buildAuthorAwardsIndex();
    assert.ok(index.size > 100);
  });
});
