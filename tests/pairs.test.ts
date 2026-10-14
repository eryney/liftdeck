import { describe, expect, it } from 'vitest';
import { fmtRest, slotLabels } from '../src/lib/pairs';

describe('slotLabels', () => {
  it('letters pairs in order of appearance and numbers straight sets by position', () => {
    const tags = slotLabels([{ pairGroup: 'x' }, { pairGroup: 'x' }, {}, { pairGroup: 'y' }, { pairGroup: 'y' }, { pairGroup: 'y' }]).map((l) => l.tag);
    expect(tags).toEqual(['A1', 'A2', '3', 'B1', 'B2', 'B3']);
    expect(slotLabels([{ pairGroup: 'y' }, { pairGroup: 'y' }])[1]).toMatchObject({ group: 'A', pos: 1, size: 2 });
    expect(slotLabels([{}])[0]).toMatchObject({ tag: '1', group: null, size: 1 });
  });
  it('fmtRest', () => {
    expect(fmtRest(75)).toBe('1:15');
    expect(fmtRest(45)).toBe('0:45');
  });
});
