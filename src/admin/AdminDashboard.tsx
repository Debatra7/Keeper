import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Palette,
  Type,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Globe,
  ImageIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import {
  readLocalSiteConfig,
  saveRemoteSiteConfig,
  fetchRemoteSiteConfig,
  applySiteConfigToDocument,
} from './siteConfig';
import { type DeveloperSiteConfig } from './types';
import type { FontSize } from '../components/FontSelector';

interface AdminDashboardProps {
  onExit: () => void;
  onLogout: () => void;
}

export function AdminDashboard({ onExit, onLogout }: AdminDashboardProps) {
  const [config, setConfig] = useState<DeveloperSiteConfig>(readLocalSiteConfig);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [newFontInput, setNewFontInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('#6366f1');

  useEffect(() => {
    let active = true;
    void fetchRemoteSiteConfig().then((remote) => {
      if (active && remote) {
        setConfig(remote);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const ok = await saveRemoteSiteConfig(config);
      applySiteConfigToDocument(config);
      if (ok) {
        setStatusMessage({ type: 'success', text: 'Developer settings saved successfully!' });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Saved to local browser cache, but Supabase table update encountered an error.',
        });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Error saving settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const addFont = () => {
    const trimmed = newFontInput.trim();
    if (!trimmed) return;
    if (config.allowedFonts.includes(trimmed)) {
      setNewFontInput('');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      allowedFonts: [...prev.allowedFonts, trimmed],
    }));
    setNewFontInput('');
  };

  const removeFont = (fontToRemove: string) => {
    if (config.allowedFonts.length <= 1) {
      alert('At least one font must remain available.');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      allowedFonts: prev.allowedFonts.filter((f) => f !== fontToRemove),
      defaultFont: prev.defaultFont === fontToRemove ? prev.allowedFonts[0] : prev.defaultFont,
    }));
  };

  const addColor = () => {
    const val = newColorInput.trim();
    if (!/^#[\da-f]{6}$/i.test(val)) {
      alert('Please enter a valid 6-character hex color (e.g. #6366f1)');
      return;
    }
    if (config.accentPalette.includes(val)) return;
    setConfig((prev) => ({
      ...prev,
      accentPalette: [...prev.accentPalette, val],
    }));
  };

  const removeColor = (colorToRemove: string) => {
    if (config.accentPalette.length <= 1) {
      alert('At least one color option must remain.');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      accentPalette: prev.accentPalette.filter((c) => c !== colorToRemove),
    }));
  };

  return (
    <div className="admin-root min-h-screen h-screen overflow-y-auto bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onExit}
            className="border-neutral-800 text-neutral-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to App
          </Button>
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200">Developer Dashboard</span>
            <Badge variant="default" className="text-[10px] tracking-wide">
              ADMIN
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-neutral-400 hover:text-red-400"
          >
            Lock Session
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 pb-24 space-y-6">
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-in fade-in duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Analytics Card */}
        <Card className="border-neutral-800 bg-neutral-900/40 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Vercel Analytics Integration
              </CardTitle>
              <CardDescription>
                Telemetry & Web Vitals tracking active via{' '}
                <code className="text-indigo-300">@vercel/analytics</code>.
              </CardDescription>
            </div>
            <Badge
              variant="default"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              Active / Tracking
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60 flex flex-col justify-between">
              <span className="text-neutral-400">Audience & Sessions</span>
              <span className="text-lg font-bold text-neutral-200 mt-2">Vercel Insights</span>
              <span className="text-[11px] text-neutral-500 mt-1">Real-time visitor telemetry</span>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60 flex flex-col justify-between">
              <span className="text-neutral-400">Core Web Vitals</span>
              <span className="text-lg font-bold text-neutral-200 mt-2">LCP, FID, CLS</span>
              <span className="text-[11px] text-neutral-500 mt-1">
                Automatic client performance reporting
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/60 flex flex-col justify-between">
              <span className="text-neutral-400">Vercel Console</span>
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline flex items-center gap-1 font-medium mt-2"
              >
                Open Vercel Analytics <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[11px] text-neutral-500 mt-1">Aggregated data & graphs</span>
            </div>
          </CardContent>
        </Card>

        {/* Website Meta & Favicon */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-neutral-800 bg-neutral-900/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-indigo-400" /> Branding & Meta
              </CardTitle>
              <CardDescription>
                Customize website title and custom favicon icon URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Website Title</label>
                <Input
                  value={config.siteTitle}
                  onChange={(e) => setConfig({ ...config, siteTitle: e.target.value })}
                  placeholder="e.g. Keeper"
                  className="bg-neutral-950 border-neutral-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Favicon Icon URL</label>
                <div className="flex gap-2">
                  <Input
                    value={config.faviconUrl}
                    onChange={(e) => setConfig({ ...config, faviconUrl: e.target.value })}
                    placeholder="https://example.com/favicon.png or /favicon.ico"
                    className="bg-neutral-950 border-neutral-800"
                  />
                  {config.faviconUrl && (
                    <div className="w-9 h-9 rounded border border-neutral-700 bg-neutral-900 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={config.faviconUrl}
                        alt="Favicon preview"
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500">
                  Direct HTTPS link to .ico, .png, or .svg icon.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Default Looks */}
          <Card className="border-neutral-800 bg-neutral-900/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Default App Looks
              </CardTitle>
              <CardDescription>
                Set the default theme configuration for newly visiting users.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Default Accent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.defaultAccent}
                      onChange={(e) => setConfig({ ...config, defaultAccent: e.target.value })}
                      className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
                    />
                    <Input
                      value={config.defaultAccent}
                      onChange={(e) => setConfig({ ...config, defaultAccent: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    Default Background Mode
                  </label>
                  <select
                    value={config.defaultBackground}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        defaultBackground: e.target.value as 'solid' | 'gradient' | 'image',
                      })
                    }
                    className="w-full h-9 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="solid">Solid Color</option>
                    <option value="gradient">Gradient Blend</option>
                    <option value="image">Wallpaper Image</option>
                  </select>
                </div>
              </div>

              {/* Dynamic inputs based on selected background mode */}
              {config.defaultBackground === 'image' ? (
                <div className="space-y-1.5 p-3.5 rounded-lg border border-indigo-950/60 bg-indigo-950/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Default Wallpaper Image URL</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={config.defaultImage}
                      onChange={(e) => setConfig({ ...config, defaultImage: e.target.value })}
                      placeholder="https://images.unsplash.com/photo-... (HTTPS image URL)"
                      className="bg-neutral-950 border-neutral-800"
                    />
                    {config.defaultImage && (
                      <div className="w-9 h-9 rounded border border-neutral-700 bg-neutral-900 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={config.defaultImage}
                          alt="Wallpaper preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Enter the URL of the wallpaper photo to display by default for visitors.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-300">
                      {config.defaultBackground === 'gradient'
                        ? 'Primary Color'
                        : 'Background Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.defaultColor1}
                        onChange={(e) => setConfig({ ...config, defaultColor1: e.target.value })}
                        className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
                      />
                      <Input
                        value={config.defaultColor1}
                        onChange={(e) => setConfig({ ...config, defaultColor1: e.target.value })}
                        className="bg-neutral-950 border-neutral-800 uppercase"
                      />
                    </div>
                  </div>

                  {config.defaultBackground === 'gradient' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-300">
                        Secondary Gradient Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={config.defaultColor2}
                          onChange={(e) => setConfig({ ...config, defaultColor2: e.target.value })}
                          className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
                        />
                        <Input
                          value={config.defaultColor2}
                          onChange={(e) => setConfig({ ...config, defaultColor2: e.target.value })}
                          className="bg-neutral-950 border-neutral-800 uppercase"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center text-xs text-neutral-500 pt-5">
                      <span>Solid background uses Primary Color.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Default Font</label>
                  <select
                    value={config.defaultFont}
                    onChange={(e) => setConfig({ ...config, defaultFont: e.target.value })}
                    className="w-full h-9 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1 text-sm text-neutral-100 focus:outline-none"
                  >
                    {config.allowedFonts.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Default Size</label>
                  <select
                    value={config.defaultFontSize}
                    onChange={(e) =>
                      setConfig({ ...config, defaultFontSize: Number(e.target.value) as FontSize })
                    }
                    className="w-full h-9 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1 text-sm text-neutral-100 focus:outline-none"
                  >
                    <option value={14}>Small (14px)</option>
                    <option value={16}>Medium (16px)</option>
                    <option value={20}>Large (20px)</option>
                    <option value={24}>Extra Large (24px)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Color Palette Options for Settings */}
        <Card className="border-neutral-800 bg-neutral-900/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="w-4 h-4 text-indigo-400" /> Color Palette Options for User
              Settings
            </CardTitle>
            <CardDescription>
              Configure the curated accent color swatches offered in the Appearance Settings panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {config.accentPalette.map((color) => (
                <div
                  key={color}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950/80 group"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ background: color }}
                  />
                  <span className="text-xs font-mono text-neutral-300 uppercase">{color}</span>
                  <button
                    onClick={() => removeColor(color)}
                    title={`Remove ${color}`}
                    className="text-neutral-500 hover:text-red-400 ml-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 max-w-sm">
              <input
                type="color"
                value={newColorInput}
                onChange={(e) => setNewColorInput(e.target.value)}
                className="w-9 h-9 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
              />
              <Input
                value={newColorInput}
                onChange={(e) => setNewColorInput(e.target.value)}
                placeholder="#6366f1"
                className="bg-neutral-950 border-neutral-800 uppercase"
              />
              <Button size="sm" onClick={addColor} variant="secondary">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Swatch
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Font Options for Settings */}
        <Card className="border-neutral-800 bg-neutral-900/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Type className="w-4 h-4 text-indigo-400" /> Font Options for User Settings
            </CardTitle>
            <CardDescription>
              Control which typography choices are exposed in user appearance preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {config.allowedFonts.map((font) => (
                <div
                  key={font}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/80"
                >
                  <div className="truncate mr-2">
                    <p className="text-xs font-medium text-neutral-200 truncate">{font}</p>
                    <p
                      className="text-[10px] text-neutral-500 truncate"
                      style={{ fontFamily: `'${font}', sans-serif` }}
                    >
                      Quick brown fox
                    </p>
                  </div>
                  <button
                    onClick={() => removeFont(font)}
                    title={`Remove ${font}`}
                    className="text-neutral-500 hover:text-red-400 p-1 bg-transparent border-0 hover:bg-transparent shadow-none transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md">
              <Input
                value={newFontInput}
                onChange={(e) => setNewFontInput(e.target.value)}
                placeholder="Font name, e.g. Inter or Fira Code"
                className="bg-neutral-950 border-neutral-800"
                onKeyDown={(e) => e.key === 'Enter' && addFont()}
              />
              <Button size="sm" onClick={addFont} variant="secondary">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Font
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
