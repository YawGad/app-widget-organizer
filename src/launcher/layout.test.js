import test from 'node:test';
import assert from 'node:assert/strict';
import { getGridCapacity, reconcileLayout } from './layout.js';

const app = (packageName, label = packageName) => ({ packageName, label });
const inventory = (...names) => names.map((name) => app(name));

test('compacts a gap in the middle of a row in stable reading order', () => {
  const result = reconcileLayout(
    {
      gridDensity: '4x5',
      placements: ['a', 'b', 'c', 'd', 'e'],
      positions: { a: 0, b: 1, c: 2, d: 4, e: 5 },
      pinnedApps: [],
      categories: {},
    },
    inventory('a', 'b', 'c', 'd'),
  );
  assert.deepEqual(result.state.placements, ['a', 'b', 'c', 'd']);
  assert.deepEqual(result.state.positions, { a: 0, b: 1, c: 2, d: 3 });
  assert.deepEqual(result.movedPackages, ['d']);
});

test('removes an app from the middle and compacts remaining entries', () => {
  const result = reconcileLayout(
    { placements: ['a', 'b', 'c', 'd'], pinnedApps: [], categories: {} },
    inventory('a', 'c', 'd'),
  );
  assert.deepEqual(result.state.placements, ['a', 'c', 'd']);
  assert.deepEqual(result.state.positions, { a: 0, c: 1, d: 2 });
  assert.deepEqual(result.removedPackages, ['b']);
});

test('removes multiple uninstalled apps and reports each removal once', () => {
  const result = reconcileLayout(
    { placements: ['a', 'b', 'c', 'd'], pinnedApps: ['d'], categories: { b: 'Media' } },
    inventory('a', 'c'),
  );
  assert.deepEqual(result.state.placements, ['a', 'c']);
  assert.deepEqual(result.state.pinnedApps, []);
  assert.deepEqual(result.removedPackages, ['b', 'd']);
});

test('handles empty and full grids without dropping placements', () => {
  const empty = reconcileLayout({}, []);
  assert.deepEqual(empty.state.placements, []);

  const apps = inventory(...Array.from({ length: 30 }, (_, index) => `app${index}`));
  const full = reconcileLayout({}, apps, '5x6');
  assert.equal(full.state.placements.length, 30);
  assert.equal(getGridCapacity('5x6'), 30);
});

test('changes grid density without changing stable placement order', () => {
  const placements = ['a', 'b', 'c', 'd'];
  const result = reconcileLayout(
    { gridDensity: '4x5', placements, pinnedApps: [], categories: {} },
    inventory(...placements),
    '5x6',
  );
  assert.equal(result.state.gridDensity, '5x6');
  assert.deepEqual(result.state.placements, placements);
  assert.equal(getGridCapacity(result.state.gridDensity), 30);
});

test('preserves installed dock pins and excludes them from the home grid', () => {
  const result = reconcileLayout(
    { placements: ['a', 'b', 'c'], pinnedApps: ['b'], categories: {} },
    inventory('a', 'b', 'c'),
  );
  assert.deepEqual(result.state.pinnedApps, ['b']);
  assert.deepEqual(result.state.placements, ['a', 'c']);
});

test('deduplicates package identifiers in inventory and saved state', () => {
  const result = reconcileLayout(
    { placements: ['a', 'a', 'missing'], pinnedApps: ['b', 'b'], categories: {} },
    [app('a'), app('a', 'duplicate'), app('b')],
  );
  assert.deepEqual(result.state.placements, ['a']);
  assert.deepEqual(result.state.pinnedApps, ['b']);
  assert.deepEqual(result.removedPackages, ['missing']);
});

test('keeps stable order between repeated reconciliations and preserves folders', () => {
  const saved = {
    placements: ['b', 'a'],
    pinnedApps: [],
    categories: { a: 'Media' },
    folders: [{ id: 'custom', name: 'My folder', packageNames: ['a', 'b', 'gone'] }],
  };
  const apps = [app('a', 'Camera'), app('b', 'Calendar'), app('c', 'New app')];
  const first = reconcileLayout(saved, apps);
  const second = reconcileLayout(first.state, apps);
  assert.deepEqual(first.state.placements, ['b', 'a', 'c']);
  assert.deepEqual(second.state.placements, first.state.placements);
  assert.equal(first.state.categories.a, 'Media');
  assert.equal(first.state.categories.c, 'Other');
  assert.deepEqual(first.state.folders, [{ id: 'custom', name: 'My folder', packageNames: ['a', 'b'] }]);
});

test('categorizes launchable apps using their labels and package metadata', () => {
  const result = reconcileLayout(
    {},
    [
      app('org.example.chat', 'Chat'),
      app('org.example.calendar', 'Calendar'),
      app('org.example.player', 'Video Player'),
      app('org.example.calc', 'Calculator'),
    ],
  );
  assert.deepEqual(Object.values(result.state.categories), ['Communication', 'Productivity', 'Media', 'Utilities']);
});

test('preserves an existing folder when its last installed app is removed', () => {
  const result = reconcileLayout(
    { placements: ['gone'], folders: [{ id: 'keep', name: 'Keep this folder', packageNames: ['gone'] }] },
    [],
  );
  assert.deepEqual(result.state.folders, [{ id: 'keep', name: 'Keep this folder', packageNames: [] }]);
});
