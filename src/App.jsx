import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  HelpCircle,
  Clock3,
  Grid2X2,
  Home,
  ListFilter,
  Loader2,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { APP_CATEGORIES, createDefaultLayoutState, getGridCapacity, GRID_PRESETS, reconcileLayout } from './launcher/layout.js';
import { SmartLauncher } from './launcher/native.js';

const STORAGE_KEY = 'smart-launcher-layout-v1';
const DEMO_APPS = [
  { packageName: 'demo.phone', label: 'Phone' },
  { packageName: 'demo.messages', label: 'Messages' },
  { packageName: 'demo.camera', label: 'Camera' },
  { packageName: 'demo.photos', label: 'Photos' },
  { packageName: 'demo.calendar', label: 'Calendar' },
  { packageName: 'demo.browser', label: 'Browser' },
  { packageName: 'demo.music', label: 'Music' },
  { packageName: 'demo.files', label: 'Files' },
  { packageName: 'demo.maps', label: 'Maps' },
  { packageName: 'demo.notes', label: 'Notes' },
  { packageName: 'demo.settings', label: 'Settings' },
  { packageName: 'demo.store', label: 'App Store' },
];

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function formatLastCleaned(value) {
  if (!value) return 'Not cleaned yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not cleaned yet';
  return `Last cleaned ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
}

function AppIcon({ app, compact = false }) {
  if (app.iconDataUri) {
    return <img className={`app-icon-image${compact ? ' compact' : ''}`} src={app.iconDataUri} alt="" loading="lazy" />;
  }
  return (
    <span className={`app-icon-fallback${compact ? ' compact' : ''}`} aria-hidden="true">
      {(app.label || app.packageName || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

function AppTile({ app, pinned, onLaunch, onPin, compact = false }) {
  return (
    <article className={`app-tile${compact ? ' compact' : ''}`}>
      <button className="app-launch" type="button" onClick={() => onLaunch(app)} aria-label={`Launch ${app.label}`}>
        <AppIcon app={app} compact={compact} />
        <span className="app-label">{app.label}</span>
      </button>
      {onPin && (
        <button
          className={`pin-button${pinned ? ' is-pinned' : ''}`}
          type="button"
          onClick={() => onPin(app.packageName)}
          aria-label={pinned ? `Unpin ${app.label}` : `Pin ${app.label} to dock`}
          title={pinned ? 'Unpin from dock' : 'Pin to dock'}
        >
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      )}
    </article>
  );
}

function App() {
  const [layout, setLayout] = useState(createDefaultLayoutState);
  const layoutRef = useRef(layout);
  const homeGridRef = useRef(null);
  const homePositionRef = useRef(new Map());
  const [inventory, setInventory] = useState([]);
  const [isNative, setIsNative] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [undoState, setUndoState] = useState(null);
  const [activeScreen, setActiveScreen] = useState('home');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [now, setNow] = useState(() => new Date());
  const [defaultStatus, setDefaultStatus] = useState(null);
  const [defaultStatusLoading, setDefaultStatusLoading] = useState(false);

  const persistLayout = (next) => {
    layoutRef.current = next;
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError('');
      return true;
    } catch (storageError) {
      setError(`Your layout could not be saved on this device: ${storageError.message}`);
      return false;
    }
  };

  const refreshInventory = async (reason = 'refresh') => {
    const apps = isNative ? (await SmartLauncher.getInstalledApps()).apps : DEMO_APPS;
    if (!Array.isArray(apps)) throw new Error('The native app inventory returned an invalid response.');
    setInventory(apps);
    const result = reconcileLayout(layoutRef.current, apps, layoutRef.current.gridDensity);
    const autoTidied = reason === 'packageRemoved' || result.removedPackages.length > 0;
    const next = {
      ...result.state,
      lastCleanedAt: autoTidied ? new Date().toISOString() : result.state.lastCleanedAt,
    };
    persistLayout(next);
    if (result.removedPackages.length || result.addedPackages.length || reason === 'packageRemoved') {
      setSummary(
        `${result.removedPackages.length} removed · ${result.addedPackages.length} added · ${next.placements.length} apps compacted`,
      );
    }
    return result;
  };

  useEffect(() => {
    let active = true;
    const nativePlatform = Capacitor.isNativePlatform();
    setIsNative(nativePlatform);

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Saved launcher layout has an invalid format.');
        const savedLayout = { ...createDefaultLayoutState(), ...parsed };
        if (
          !Array.isArray(savedLayout.placements)
          || !Array.isArray(savedLayout.pinnedApps)
          || !Array.isArray(savedLayout.folders)
          || !savedLayout.categories
          || typeof savedLayout.categories !== 'object'
          || Array.isArray(savedLayout.categories)
        ) {
          throw new Error('Saved launcher layout has an invalid format.');
        }
        layoutRef.current = savedLayout;
        setLayout(layoutRef.current);
      }
    } catch (storageError) {
      setError(`Saved layout could not be read: ${storageError.message}`);
    }

    const updateInventory = async (reason) => {
      const apps = nativePlatform ? (await SmartLauncher.getInstalledApps()).apps : DEMO_APPS;
      if (!active) return;
      if (!Array.isArray(apps)) throw new Error('The native app inventory returned an invalid response.');
      setInventory(apps);
      const result = reconcileLayout(layoutRef.current, apps, layoutRef.current.gridDensity);
      const autoTidied = reason === 'packageRemoved' || result.removedPackages.length > 0;
      const next = {
        ...result.state,
        lastCleanedAt: autoTidied ? new Date().toISOString() : result.state.lastCleanedAt,
      };
      layoutRef.current = next;
      setLayout(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (storageError) {
        setError(`Your layout could not be saved on this device: ${storageError.message}`);
      }
      if (result.removedPackages.length || result.addedPackages.length || reason === 'packageRemoved') {
        setSummary(
          `${result.removedPackages.length} removed · ${result.addedPackages.length} added · ${next.placements.length} apps compacted`,
        );
      }
    };

    const listenerHandles = [];
    if (nativePlatform) {
      Promise.allSettled([
        SmartLauncher.addListener('packageRemoved', () => updateInventory('packageRemoved').catch((listenerError) => {
          if (active) setError(`Could not refresh apps after removal: ${listenerError.message}`);
        })),
        SmartLauncher.addListener('inventoryRefresh', () => updateInventory('foreground').catch((listenerError) => {
          if (active) setError(`Could not refresh the app inventory: ${listenerError.message}`);
        })),
      ]).then((results) => {
        const handles = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
        if (active) listenerHandles.push(...handles);
        else handles.forEach((handle) => handle.remove().catch((removeError) => console.error('Could not remove launcher listener:', removeError)));
        const failedRegistration = results.find((result) => result.status === 'rejected');
        if (active && failedRegistration) {
          setError(`Launcher change notifications are unavailable: ${failedRegistration.reason?.message ?? failedRegistration.reason}`);
        }
      });
    }

    updateInventory('startup')
      .catch((loadError) => {
        if (active) setError(`Could not load installed applications: ${loadError.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      listenerHandles.forEach((handle) => handle.remove().catch((removeError) => console.error('Could not remove launcher listener:', removeError)));
    };
  }, []);

  const appsByPackage = useMemo(
    () => new Map(inventory.map((app) => [app.packageName, app])),
    [inventory],
  );
  const dockApps = layout.pinnedApps.map((packageName) => appsByPackage.get(packageName)).filter(Boolean);
  const homeApps = layout.placements
    .slice(0, getGridCapacity(layout.gridDensity))
    .map((packageName) => appsByPackage.get(packageName))
    .filter(Boolean);

  useLayoutEffect(() => {
    const gridElement = homeGridRef.current;
    if (!gridElement) return;
    const nextPositions = new Map();
    gridElement.querySelectorAll('[data-package-name]').forEach((element) => {
      const packageName = element.getAttribute('data-package-name');
      const next = element.getBoundingClientRect();
      const previous = homePositionRef.current.get(packageName);
      if (previous && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const x = previous.left - next.left;
        const y = previous.top - next.top;
        if (x || y) {
          element.animate(
            [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
            { duration: 280, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' },
          );
        }
      }
      nextPositions.set(packageName, { left: next.left, top: next.top });
    });
    homePositionRef.current = nextPositions;
  }, [homeApps, layout.gridDensity]);
  const filteredApps = inventory.filter((app) => {
    const matchesSearch = `${app.label} ${app.packageName}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = selectedCategory === 'All' || layout.categories[app.packageName] === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const launchApp = async (app) => {
    if (!isNative) {
      setSummary(`${app.label} is a demo app; install the Android build to launch real apps.`);
      return;
    }
    try {
      await SmartLauncher.launchApp({ packageName: app.packageName });
      setError('');
    } catch (launchError) {
      setError(`Could not launch ${app.label}: ${launchError.message}`);
    }
  };

  const tidyApps = async () => {
    try {
      const apps = isNative ? (await SmartLauncher.getInstalledApps()).apps : inventory;
      if (!Array.isArray(apps)) throw new Error('The native app inventory returned an invalid response.');
      const result = reconcileLayout(layoutRef.current, apps, layoutRef.current.gridDensity);
      const next = { ...result.state, lastCleanedAt: new Date().toISOString() };
      setUndoState(layoutRef.current);
      setInventory(apps);
      const saved = persistLayout(next);
      setSummary(saved
        ? result.removedPackages.length || result.addedPackages.length
          ? `${result.removedPackages.length} removed · ${result.addedPackages.length} added · ${next.placements.length} apps compacted`
          : `Layout is tidy · ${next.placements.length} apps arranged`
        : 'Layout compacted for this session, but could not be saved.');
    } catch (tidyError) {
      setError(`Auto-tidy could not finish: ${tidyError.message}`);
    }
  };

  const undoTidy = () => {
    if (!undoState) return;
    const saved = persistLayout(reconcileLayout(undoState, inventory).state);
    setUndoState(null);
    setSummary(saved ? 'Undid the most recent manual tidy.' : 'Undo applied for this session, but could not be saved.');
  };

  const changeGridDensity = (gridDensity) => {
    const result = reconcileLayout(layoutRef.current, inventory, gridDensity);
    persistLayout(result.state);
    setUndoState(null);
  };

  const togglePinnedApp = (packageName) => {
    const current = layoutRef.current;
    const pinnedApps = current.pinnedApps.includes(packageName)
      ? current.pinnedApps.filter((item) => item !== packageName)
      : [...current.pinnedApps, packageName];
    persistLayout(reconcileLayout({ ...current, pinnedApps }, inventory).state);
    setUndoState(null);
  };

  const clearSavedLayout = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      const reset = reconcileLayout(createDefaultLayoutState(), inventory).state;
      setError('');
      const saved = persistLayout(reset);
      setUndoState(null);
      setSummary(saved ? 'Launcher layout reset.' : 'Launcher layout reset for this session, but could not be saved.');
    } catch (resetError) {
      setError(`Could not reset the saved layout: ${resetError.message}`);
    }
  };

  const checkDefaultLauncher = async () => {
    if (!isNative) {
      setDefaultStatus({ isDefault: false, supported: false });
      return;
    }
    setDefaultStatusLoading(true);
    try {
      setDefaultStatus(await SmartLauncher.getDefaultLauncherStatus());
    } catch (statusError) {
      setError(`Could not check the default Home app: ${statusError.message}`);
    } finally {
      setDefaultStatusLoading(false);
    }
  };

  const openDefaultLauncherSettings = async () => {
    try {
      await SmartLauncher.openDefaultLauncherSettings();
      setError('');
    } catch (settingsError) {
      setError(`Could not open Android Home-app settings: ${settingsError.message}`);
    }
  };

  const grid = GRID_PRESETS[layout.gridDensity] ?? GRID_PRESETS['4x6'];

  return (
    <main className="launcher-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setActiveScreen('home')}>
          <span className="brand-mark"><Sparkles size={20} /></span>
          <span>Orbit<span className="brand-light"> Launcher</span></span>
        </a>
        <div className="topbar-right">
          <span className={`mode-badge ${isNative ? 'native' : 'demo'}`}>
            <span className="status-dot" />
            {isNative ? 'Android launcher' : 'Browser demo · sample apps'}
          </span>
          <nav className="primary-nav" aria-label="Main navigation">
            <button className={activeScreen === 'home' ? 'active' : ''} onClick={() => setActiveScreen('home')}>
              <Home size={16} /> Home
            </button>
            <button className={activeScreen === 'apps' ? 'active' : ''} onClick={() => setActiveScreen('apps')}>
              <Grid2X2 size={16} /> Apps
            </button>
            <button className={activeScreen === 'settings' ? 'active' : ''} onClick={() => setActiveScreen('settings')}>
              <Settings size={16} /> Settings
            </button>
          </nav>
        </div>
      </header>

      <section className="launcher-content">
        {error && (
          <div className="error-banner" role="alert">
            <ShieldAlert size={19} />
            <span>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={17} /></button>
          </div>
        )}

        {activeScreen === 'home' && (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">{isNative ? 'YOUR ANDROID HOME' : 'PREVIEW MODE'}</p>
                <h1>Your apps, in order.</h1>
                <p className="welcome-copy">
                  A calmer home screen that finds gaps, clears stale shortcuts, and keeps your dock close.
                </p>
              </div>
              <button className="refresh-button" type="button" onClick={() => refreshInventory('refresh').catch((refreshError) => setError(refreshError.message))} disabled={loading}>
                <RefreshCw size={16} /> Refresh apps
              </button>
            </section>

            <section className="status-strip" aria-live="polite">
              {loading ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
              <div>
                <strong>{loading ? 'Finding your apps…' : `${inventory.length} launchable apps found`}</strong>
                <span>{summary || formatLastCleaned(layout.lastCleanedAt)}</span>
              </div>
              {undoState && (
                <button className="text-button undo-button" type="button" onClick={undoTidy}>
                  <Undo2 size={15} /> Undo tidy
                </button>
              )}
            </section>

            <div className="home-layout">
              <section className="home-panel">
                <div className="clock-block">
                  <p className="clock-time">{formatTime(now)}</p>
                  <p className="clock-date">{formatDate(now)}</p>
                  <span className="clock-caption">A little more room to breathe.</span>
                </div>

                <div className="home-panel-heading">
                  <div>
                    <h2>Home screen</h2>
                    <p>{layout.gridDensity} grid <span aria-hidden="true">·</span> {homeApps.length} of {layout.placements.length} shown</p>
                  </div>
                  <label className="density-select">
                    <span className="visually-hidden">Home grid size</span>
                    <select value={layout.gridDensity} onChange={(event) => changeGridDensity(event.target.value)} disabled={loading}>
                      {Object.keys(GRID_PRESETS).map((density) => <option key={density}>{density}</option>)}
                    </select>
                  </label>
                </div>

                {loading ? (
                  <div className="loading-state"><Loader2 className="spin" size={24} /><span>Loading app inventory</span></div>
                ) : inventory.length === 0 ? (
                  <div className="empty-state">
                    <HelpCircle size={25} />
                    <strong>No launchable apps found</strong>
                    <span>Check app visibility and try refreshing the installed-app list.</span>
                  </div>
                ) : (
                  <div className="home-grid" ref={homeGridRef} style={{ '--grid-columns': grid.columns }}>
                    {homeApps.map((app) => (
                      <div className="home-grid-item" key={app.packageName} data-package-name={app.packageName}>
                        <AppTile app={app} pinned={layout.pinnedApps.includes(app.packageName)} onLaunch={launchApp} onPin={togglePinnedApp} />
                      </div>
                    ))}
                    {homeApps.length === 0 && <p className="empty-grid">All apps are in your dock or drawer.</p>}
                  </div>
                )}

                {dockApps.length > 0 && (
                  <div className="dock-section">
                    <p className="dock-label">PINNED DOCK</p>
                    <div className="dock-grid">
                      {dockApps.map((app) => (
                        <AppTile key={app.packageName} app={app} pinned onLaunch={launchApp} onPin={togglePinnedApp} compact />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <aside className="organize-panel">
                <div className="tidy-card">
                  <div className="tidy-icon"><Sparkles size={22} /></div>
                  <p className="eyebrow">SMART AUTO-TIDY</p>
                  <h2>Make space for what matters.</h2>
                  <p>Refresh your installed apps, remove stale entries, and pack the grid neatly from left to right.</p>
                  <button className="tidy-button" type="button" onClick={tidyApps} disabled={loading}>
                    <Sparkles size={17} /> Clean &amp; Auto-Tidy
                  </button>
                  <span className="last-cleaned"><Clock3 size={14} /> {formatLastCleaned(layout.lastCleanedAt)}</span>
                </div>

                <div className="category-card">
                  <div className="card-title-row">
                    <div>
                      <p className="eyebrow">SMART CATEGORIES</p>
                      <h2>Everything has a place</h2>
                    </div>
                    <ListFilter size={18} />
                  </div>
                  <div className="category-list">
                    {APP_CATEGORIES.map((category) => {
                      const count = inventory.filter((app) => layout.categories[app.packageName] === category).length;
                      return (
                        <button key={category} type="button" onClick={() => { setSelectedCategory(category); setActiveScreen('apps'); }}>
                          <span className={`category-dot ${category.toLowerCase()}`} />
                          <span>{category}</span>
                          <strong>{count}</strong>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!isNative && (
                  <p className="demo-note">
                    <HelpCircle size={15} /> Demo apps are examples only. Installed applications and launch actions are available in the Android build.
                  </p>
                )}
              </aside>
            </div>
          </>
        )}

        {activeScreen === 'apps' && (
          <section className="apps-screen">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">APP DRAWER</p>
                <h1>Find an app</h1>
                <p>{isNative ? 'Launch an installed app or pin it to your dock.' : 'Browse sample apps in clearly labelled browser demo mode.'}</p>
              </div>
              <span className="app-count">{filteredApps.length} apps</span>
            </div>
            <label className="search-box">
              <Search size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search apps or package names" aria-label="Search installed apps" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}
            </label>
            <div className="category-filters" aria-label="Filter app categories">
              {['All', ...APP_CATEGORIES].map((category) => (
                <button key={category} type="button" className={selectedCategory === category ? 'selected' : ''} onClick={() => setSelectedCategory(category)}>
                  {category}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="loading-state"><Loader2 className="spin" size={24} /><span>Loading app inventory</span></div>
            ) : filteredApps.length === 0 ? (
              <div className="empty-state drawer-empty"><Search size={24} /><strong>No matching apps</strong><span>Try another search or category.</span></div>
            ) : (
              <div className="drawer-list">
                {filteredApps.map((app) => (
                  <div className="drawer-row" key={app.packageName}>
                    <AppIcon app={app} compact />
                    <div className="drawer-app-info">
                      <strong>{app.label}</strong>
                      <span>{layout.categories[app.packageName] || 'Other'}</span>
                    </div>
                    <button className="drawer-launch" type="button" onClick={() => launchApp(app)}>Open</button>
                    <button className={`drawer-pin${layout.pinnedApps.includes(app.packageName) ? ' is-pinned' : ''}`} type="button" onClick={() => togglePinnedApp(app.packageName)} aria-label={layout.pinnedApps.includes(app.packageName) ? `Unpin ${app.label}` : `Pin ${app.label} to dock`}>
                      <Pin size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeScreen === 'settings' && (
          <section className="settings-screen">
            <div className="screen-heading">
              <div>
                <p className="eyebrow">LAUNCHER SETTINGS</p>
                <h1>Make Orbit your Home</h1>
                <p>Android controls which app handles the Home button. Choose Orbit in system settings to use it as your default launcher.</p>
              </div>
              <Settings size={25} />
            </div>
            <div className="settings-card default-card">
              <div className="settings-card-icon"><Home size={20} /></div>
              <div className="settings-card-content">
                <h2>Default Home app</h2>
                <p>
                  {!isNative
                    ? 'This browser preview cannot inspect Android default-app settings.'
                    : defaultStatus === null
                      ? 'Check whether Orbit currently handles the Android Home button.'
                      : defaultStatus.isDefault
                        ? 'Orbit is currently selected as your default Home app.'
                        : 'Orbit is not currently selected as your default Home app.'}
                </p>
              </div>
              <span className={`default-indicator${defaultStatus?.isDefault ? ' active' : ''}`}>
                {!isNative ? 'Android only' : defaultStatus === null ? 'Not checked' : defaultStatus.isDefault ? 'Selected' : 'Not selected'}
              </span>
            </div>
            <div className="settings-actions">
              <button className="secondary-button" type="button" onClick={checkDefaultLauncher} disabled={defaultStatusLoading || !isNative}>
                {defaultStatusLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Check status
              </button>
              <button className="tidy-button settings-primary" type="button" onClick={openDefaultLauncherSettings} disabled={!isNative}>
                <Settings size={16} /> Open Home-app settings
              </button>
            </div>
            {!isNative && <p className="settings-demo-note">Build and install the Android APK to access native launcher settings.</p>}
            <div className="settings-card">
              <div className="settings-card-icon"><Grid2X2 size={20} /></div>
              <div className="settings-card-content">
                <h2>Grid and saved layout</h2>
                <p>{layout.gridDensity} grid · {layout.placements.length} home apps · {layout.pinnedApps.length} pinned dock apps · {layout.folders.length} saved folders</p>
              </div>
              <button className="secondary-button reset-button" type="button" onClick={clearSavedLayout}><ArrowDownToLine size={15} /> Reset layout</button>
            </div>
            <div className="privacy-note">
              <ShieldAlert size={17} />
              <p>Orbit reads only launchable app labels, package names, and icons. It does not open, change, disable, or uninstall other apps.</p>
            </div>
          </section>
        )}
      </section>
      <footer className="footer-note">Your layout is saved on this device. <span>Private by design.</span></footer>
    </main>
  );
}

export default App;
