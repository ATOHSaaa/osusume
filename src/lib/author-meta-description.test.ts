import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAuthorMetaDescription,
  cleanBookTitleForMetaDescription,
} from './author-meta-description';

describe('buildAuthorMetaDescription', () => {
  it('代表作を並べ、おすすめ・代表作・ランキングを含む', () => {
    const description = buildAuthorMetaDescription('三島由紀夫', [
      '金閣寺 (新潮文庫)',
      '春の雪 (新潮文庫)',
      '仮面の告白 (新潮文庫)',
      '命売ります (ちくま文庫)',
    ]);

    assert.match(description, /三島由紀夫のおすすめ作品・代表作ランキング/);
    assert.match(description, /『金閣寺』/);
    assert.match(description, /など/);
    assert.match(description, /おすすめ/);
    assert.match(description, /代表作/);
    assert.match(description, /ランキング/);
    assert.ok(description.length <= 155);
  });

  it('作品がない場合はフォールバック文を返す', () => {
    const description = buildAuthorMetaDescription('架空作家', []);
    assert.match(description, /架空作家のおすすめ作品・代表作ランキング/);
    assert.match(description, /おすすめ/);
    assert.match(description, /代表作/);
    assert.match(description, /ランキング/);
  });

  it('文庫名などの括弧書きを除去する', () => {
    assert.equal(
      cleanBookTitleForMetaDescription('金閣寺 (新潮文庫)'),
      '金閣寺'
    );
  });
});
