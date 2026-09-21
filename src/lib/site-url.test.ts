import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SITE_URL } from './constants';
import { canonicalUrl, toCanonicalPath } from './site-url';

describe('toCanonicalPath', () => {
  it('keeps the homepage slash', () => {
    assert.equal(toCanonicalPath('/'), '/');
  });

  it('adds a trailing slash to HTML paths', () => {
    assert.equal(toCanonicalPath('/authors'), '/authors/');
    assert.equal(toCanonicalPath('/authors/'), '/authors/');
    assert.equal(toCanonicalPath('/articles/foo-recommended-books'), '/articles/foo-recommended-books/');
  });

  it('does not add a trailing slash to files', () => {
    assert.equal(toCanonicalPath('/sitemap.xml'), '/sitemap.xml');
    assert.equal(toCanonicalPath('/og/default.png'), '/og/default.png');
    assert.equal(toCanonicalPath('/rss.xml'), '/rss.xml');
  });

  it('strips query strings and hashes', () => {
    assert.equal(toCanonicalPath('/?q=村上'), '/');
    assert.equal(toCanonicalPath('/authors/?utm_source=x'), '/authors/');
  });
});

describe('canonicalUrl', () => {
  it('builds an absolute URL with a trailing slash', () => {
    assert.equal(canonicalUrl('/awards/akutagawa', SITE_URL), `${SITE_URL}/awards/akutagawa/`);
  });
});
