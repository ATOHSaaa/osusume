import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AWARD_BY_SLUG } from './registry';
import {
  buildAwardSessionPageDescription,
  buildAwardSessionPageTitle,
  getAdjacentPrizeSessions,
  getAwardSessionPath,
  getPrizeSession,
  getPrizeSessions,
  parseAwardSessionParam,
} from './session';

describe('parseAwardSessionParam', () => {
  it('parses positive integers', () => {
    assert.equal(parseAwardSessionParam('175'), 175);
  });

  it('rejects invalid values', () => {
    assert.equal(parseAwardSessionParam('0'), null);
    assert.equal(parseAwardSessionParam('abc'), null);
  });
});

describe('getAwardSessionPath', () => {
  it('builds a session page path', () => {
    assert.equal(getAwardSessionPath('akutagawa', 175), '/awards/akutagawa/175/');
  });
});

describe('award session helpers', () => {
  const award = AWARD_BY_SLUG.get('akutagawa');
  assert.ok(award);

  it('finds a known session', () => {
    const sessions = getPrizeSessions(award!);
    assert.ok(sessions.length > 0);
    const latest = sessions[0]!;
    const found = getPrizeSession(award!, latest.session);
    assert.equal(found?.session, latest.session);
    assert.ok(found!.winners.length > 0);
  });

  it('returns adjacent sessions in descending order', () => {
    const sessions = getPrizeSessions(award!);
    const middle = sessions[Math.floor(sessions.length / 2)]!;
    const adjacent = getAdjacentPrizeSessions(award!, middle.session);
    assert.equal(adjacent.previous?.session, sessions[sessions.indexOf(middle) - 1]?.session);
    assert.equal(adjacent.next?.session, sessions[sessions.indexOf(middle) + 1]?.session);
  });

  it('builds page metadata', () => {
    const session = getPrizeSessions(award!)[0]!;
    assert.equal(buildAwardSessionPageTitle('芥川賞', session.session), `第${session.session}回 芥川賞`);
    assert.match(
      buildAwardSessionPageDescription(
        '芥川賞',
        session.session,
        session.period,
        session.winners.length,
        true
      ),
      /芥川賞第\d+回/
    );
  });
});
