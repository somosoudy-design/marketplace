import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { initialRecentVisibleCount } from '../../../apps/mobile/src/components/catalog/recent-visibility.ts';

test('counts only cards that meet the horizontal 60% visibility threshold', () => {
  for (const [count, viewport, card, expected] of [
    [10, 280, 228, 1], [10, 320, 249.6, 1], [10, 412, 280, 1], [10, 720, 280, 2], [10, 1000, 280, 3],
    [1, 720, 280, 1], [0, 320, 249.6, 0], [10, 473.99, 280, 1], [10, 474, 280, 2], [10, 0, 280, 0], [10, 320, 0, 0],
  ]) assert.equal(initialRecentVisibleCount(count, viewport, card), expected, `${count}/${viewport}/${card}`);
});
