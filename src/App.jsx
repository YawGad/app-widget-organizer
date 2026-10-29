import React, { useState } from 'react';
import { 
  Smartphone, LayoutGrid, Palette, Sparkles, Sliders, Layers, 
  FolderPlus, Download, Cpu, RefreshCw, CheckCircle2, Copy, Zap,
  Calendar, Sun, Battery, Music, Check, Moon, Shield, Play
} from 'lucide-react';

export default function App() {
  const [gridDensity, setGridDensity] = useState('4x6');
  const [theme, setTheme] = useState('darkGlass');
  const [activeTab, setActiveTab] = useState('canvas');
  const [copiedCode, setCopiedCode] = useState(false);

  const presets = [
    { name: 'Productivity Focus', icon: '💼', desc: 'Minimal screen 1, grouped utilities' },
    { name: 'Zen Minimalist', icon: '🌿', desc: '1-page layout with single key widget' },
    { name: 'Developer & Creator', icon: '⚡', desc: 'Analytics top, quick IDE launcher' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <Smartphone className="text-teal-400" /> App & Widget Organizer
          </h1>
          <p className="text-slate-400 text-sm mt-1">Design, personalize, and package your mobile home screen layouts</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('canvas')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'canvas' ? 'bg-teal-500 text-slate-950 font-semibold' : 'bg-slate-900 border border-slate-800 hover:border-slate-700'}`}
          >
            Canvas Studio
          </button>
          <button 
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === 'export' ? 'bg-teal-500 text-slate-950 font-semibold' : 'bg-slate-900 border border-slate-800 hover:border-slate-700'}`}
          >
            Export & Build APK
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto">
        {activeTab === 'canvas' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Phone Screen Canvas Simulator */}
            <div className="lg:col-span-1 flex flex-col items-center">
              <div className="w-[310px] h-[620px] bg-slate-900 border-4 border-slate-700 rounded-[40px] p-4 shadow-2xl relative flex flex-col justify-between overflow-hidden">
                {/* Dynamic Wallpaper Theme */}
                <div className={`absolute inset-0 z-0 transition-all duration-500 ${
                  theme === 'darkGlass' ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950' :
                  theme === 'neon' ? 'bg-gradient-to-br from-purple-950 via-slate-950 to-pink-950' :
                  theme === 'greige' ? 'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950' :
                  'bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950'
                }`} />

                {/* Status Bar */}
                <div className="relative z-10 flex justify-between items-center text-xs text-slate-400 px-2 pt-1">
                  <span>9:41</span>
                  <div className="w-16 h-4 bg-slate-950 rounded-full mx-auto" />
                  <div className="flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Mock Phone App Grid */}
                <div className="relative z-10 my-auto grid grid-cols-4 gap-3 p-2">
                  {/* Mock Widget */}
                  <div className="col-span-4 bg-slate-800/60 backdrop-blur-md rounded-2xl p-3 border border-slate-700/50 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-teal-400 font-semibold">Friday, Oct 30</p>
                      <p className="text-lg font-bold">28°C Sunny</p>
                    </div>
                    <Sun className="text-amber-400 w-8 h-8" />
                  </div>

                  {/* App Icons */}
                  {['Messages', 'Camera', 'Photos', 'Settings', 'Music', 'Browser', 'Notes', 'Files'].map((app, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex items-center justify-center text-teal-400 shadow-md">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium truncate w-12 text-center">{app}</span>
                    </div>
                  ))}
                </div>

                {/* Navigation Bar / Dock */}
                <div className="relative z-10 bg-slate-800/40 backdrop-blur-lg rounded-2xl p-2 border border-slate-700/40 flex justify-around items-center">
                  {['Phone', 'Mail', 'Maps', 'Store'].map((dockApp, i) => (
                    <div key={i} className="w-10 h-10 bg-teal-500/20 border border-teal-500/30 rounded-xl flex items-center justify-center text-teal-300">
                      <Zap className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Customization Options */}
            <div className="lg:col-span-2 space-y-6">
              {/* Presets Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Sparkles className="text-teal-400" /> Smart Layout Presets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {presets.map((p, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-teal-500/50 cursor-pointer transition">
                      <div className="text-2xl mb-2">{p.icon}</div>
                      <h4 className="font-medium text-sm text-slate-200">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid & Theme Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-teal-400" /> Grid Density
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['4x5', '4x6', '5x6'].map((density) => (
                      <button
                        key={density}
                        onClick={() => setGridDensity(density)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition ${
                          gridDensity === density ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {density}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center gap-2">
                    <Palette className="w-4 h-4 text-teal-400" /> Aesthetic Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'darkGlass', name: 'Dark Glass' },
                      { id: 'neon', name: 'Cyber Neon' },
                      { id: 'greige', name: 'Forest Greige' },
                      { id: 'pastel', name: 'Soft Blue' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left ${
                          theme === t.id ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* APK & Export Panel */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="text-teal-400" /> Direct APK Build & Automation Config
                </h2>
                <p className="text-sm text-slate-400 mt-1">This zipped package includes Vite, React, Capacitor, and GitHub Workflows ready for automatic compilation.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="font-semibold text-teal-400 text-sm mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Ready for Codex / Automated AI Tools
                </h3>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Includes pre-configured <code className="text-slate-200">package.json</code> & dependencies.</li>
                  <li>Capacitor Android configuration (<code className="text-slate-200">capacitor.config.json</code>).</li>
                  <li>Automated GitHub Actions workflow (<code className="text-slate-200">.github/workflows/build-apk.yml</code>).</li>
                </ul>
              </div>

              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="font-semibold text-teal-400 text-sm mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> How to Generate APK automatically
                </h3>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                  <li>Unzip this project or give the file directly to Codex.</li>
                  <li>Instruct Codex: <em>"Push this to GitHub and run the APK workflow"</em>.</li>
                  <li>Download your generated <code className="text-slate-200">app-debug.apk</code> directly from GitHub Actions!</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
