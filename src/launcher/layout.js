export const GRID_PRESETS = Object.freeze({
  '4x5': Object.freeze({ columns: 4, rows: 5 }),
  '4x6': Object.freeze({ columns: 4, rows: 6 }),
  '5x6': Object.freeze({ columns: 5, rows: 6 }),
});

export const APP_CATEGORIES = Object.freeze([
  'Communication',
  'Productivity',
  'Media',
  'Utilities',
  'Other',
]);

const CATEGORY_KEYWORDS = Object.freeze({
  Communication: [
    'message', 'messaging', 'chat', 'phone', 'dialer', 'contact', 'mail',
    'email', 'social', 'whatsapp', 'telegram', 'signal', 'discord',
  ],
  Productivity: [
    'calendar', 'document', 'office', 'note', 'task', 'drive', 'spreadsheet',
    'browser', 'finance', 'bank', 'work', 'keep',
  ],
  Media: [
    'camera', 'photo', 'gallery', 'video', 'music', 'audio', 'podcast',
    'stream', 'movie', 'player', 'youtube', 'spotify', 'netflix',
  ],
  Utilities: [
    'setting', 'file', 'calculator', 'clock', 'weather', 'map', 'keyboard',
    'scanner', 'security', 'tool', 'store',
  ],
});

export function createDefaultLayoutState() {
  return {
    version: 1,
    gridDensity: '4x6',
    placements: [],
    positions: {},
    pinnedApps: [],
    categories: {},
    folders: [],
    lastCleanedAt: null,
  };
}

export function getGridCapacity(gridDensity) {
  const preset = GRID_PRESETS[gridDensity] ?? GRID_PRESETS['4x6'];
  return preset.columns * preset.rows;
}

export function categorizeApp(app) {
  const searchable = `${app.label ?? ''} ${app.packageName ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => searchable.includes(keyword))) return category;
  }
  return 'Other';
}

function uniquePackageNames(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function uniqueApps(apps) {
  const seen = new Set();
  return apps.filter((app) => {
    if (!app || typeof app.packageName !== 'string' || !app.packageName || seen.has(app.packageName)) return false;
    seen.add(app.packageName);
    return true;
  });
}

export function reconcileLayout(savedState, installedApps, requestedGridDensity) {
  const saved = savedState && typeof savedState === 'object' ? savedState : createDefaultLayoutState();
  const apps = uniqueApps(Array.isArray(installedApps) ? installedApps : []);
  const installed = new Set(apps.map((app) => app.packageName));
  const gridDensity = GRID_PRESETS[requestedGridDensity]
    ? requestedGridDensity
    : GRID_PRESETS[saved.gridDensity]
      ? saved.gridDensity
      : '4x6';

  const pinnedApps = uniquePackageNames(saved.pinnedApps).filter((packageName) => installed.has(packageName));
  const pinned = new Set(pinnedApps);
  const previousPlacements = uniquePackageNames(saved.placements);
  const placements = previousPlacements.filter((packageName) => installed.has(packageName) && !pinned.has(packageName));
  const placed = new Set(placements);

  for (const app of apps) {
    if (!pinned.has(app.packageName) && !placed.has(app.packageName)) {
      placements.push(app.packageName);
      placed.add(app.packageName);
    }
  }

  const categories = {};
  for (const app of apps) {
    const savedCategory = saved.categories?.[app.packageName];
    categories[app.packageName] = APP_CATEGORIES.includes(savedCategory)
      ? savedCategory
      : categorizeApp(app);
  }

  const folders = Array.isArray(saved.folders)
    ? saved.folders
      .filter((folder) => folder && typeof folder.id === 'string' && typeof folder.name === 'string')
      .map((folder) => ({
        ...folder,
        packageNames: uniquePackageNames(folder.packageNames).filter((packageName) => installed.has(packageName)),
      }))
    : [];
  const positions = Object.fromEntries(placements.map((packageName, index) => [packageName, index]));

  const knownPackages = new Set([
    ...previousPlacements,
    ...uniquePackageNames(saved.pinnedApps),
    ...Object.keys(saved.categories ?? {}),
    ...Object.keys(saved.positions ?? {}),
    ...(Array.isArray(saved.folders) ? saved.folders.flatMap((folder) => uniquePackageNames(folder?.packageNames)) : []),
  ]);
  const removedPackages = [...knownPackages].filter((packageName) => !installed.has(packageName));
  const addedPackages = apps
    .map((app) => app.packageName)
    .filter((packageName) => !knownPackages.has(packageName));
  const oldPositions = new Map(previousPlacements.map((packageName, index) => [
    packageName,
    Number.isInteger(saved.positions?.[packageName]) ? saved.positions[packageName] : index,
  ]));
  const movedPackages = placements.filter((packageName, index) => (
    oldPositions.has(packageName) && oldPositions.get(packageName) !== index
  ));

  return {
    state: {
      version: 1,
      gridDensity,
      placements,
      positions,
      pinnedApps,
      categories,
      folders,
      lastCleanedAt: typeof saved.lastCleanedAt === 'string' ? saved.lastCleanedAt : null,
    },
    removedPackages,
    addedPackages,
    movedPackages,
  };
}
