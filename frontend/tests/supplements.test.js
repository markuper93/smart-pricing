import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleSupplement, supplementsForYears } from '../src/components/supplementSelection.js';

const noble = { key: 'noble', percent: 5, selectable: true, kind: 'variant' };
const ultimate = { key: 'ultimate', percent: 2, selectable: true, kind: 'variant' };
const zero = { key: 'zero', percent: 0, selectable: true, kind: 'variant' };
const accessory = { key: 'roof', percent: 1, selectable: true, kind: 'accessory' };
const note = { key: 'note', selectable: false, kind: 'note' };
const items = [noble, ultimate, zero, accessory, note];

test('variants are exclusive and accessories/unknown saved keys survive', () => {
  assert.deepEqual(toggleSupplement(['noble', 'roof', 'missing'], ultimate, items), ['roof', 'missing', 'ultimate']);
});
test('accessories accumulate and selected options can be deselected', () => {
  assert.deepEqual(toggleSupplement(['noble'], accessory, items), ['noble', 'roof']);
  assert.deepEqual(toggleSupplement(['noble', 'roof'], accessory, items), ['noble']);
});
test('zero percent variant is selectable; notes are not', () => {
  assert.deepEqual(toggleSupplement(['noble'], zero, items), ['zero']);
  assert.deepEqual(toggleSupplement([], note, items), []);
});
test('year payload retains unknown keys and isolates years', () => {
  assert.deepEqual(supplementsForYears({ 2024: ['noble', 'missing'], 2025: ['zero'] }, [2024]), { 2024: ['noble', 'missing'] });
  assert.deepEqual(supplementsForYears(undefined, [2025]), { 2025: [] });
});
