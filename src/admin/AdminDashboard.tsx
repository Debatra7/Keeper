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
  Globe,
  ImageIcon,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import {
  readLocalSiteConfig,
  saveRemoteSiteConfig,
  fetchRemoteSiteConfig,
  applySiteConfigToDocument,
} from './siteConfig';
import { parseGoogleFontLink, syncGoogleFontsToDocument } from './fontUtils';
import { type DeveloperSiteConfig } from './types';
import type { FontSize } from '../components/FontSelector';
import { AnalyticsView } from './components/AnalyticsView';

interface SortableFontCardProps {
  font: string;
  onRemove: (font: string) => void;
}

function SortableFontCard({ font, onRemove }: SortableFontCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: font,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2.5 rounded-lg border bg-neutral-950/80 transition-colors ${
        isDragging
          ? 'border-indigo-500/80 ring-1 ring-indigo-500/50 opacity-75 z-10'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 min-w-0 flex-1 cursor-grab active:cursor-grabbing select-none"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
        <div className="truncate mr-1">
          <p className="text-xs font-medium text-neutral-200 truncate">{font}</p>
          <p
            className="text-[10px] text-neutral-500 truncate"
            style={{ fontFamily: `'${font}', sans-serif` }}
          >
            Quick brown fox
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(font)}
        title={`Remove ${font}`}
        className="text-neutral-500 hover:text-red-400 p-1 bg-transparent border-0 hover:bg-transparent shadow-none transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface AdminDashboardProps {
  onExit: () => void;
}

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings');
  const [config, setConfig] = useState<DeveloperSiteConfig>(readLocalSiteConfig);
  const [savedConfig, setSavedConfig] = useState<DeveloperSiteConfig>(readLocalSiteConfig);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [newFontInput, setNewFontInput] = useState('');
  const [fontInputError, setFontInputError] = useState<string | null>(null);
  const [newColorInput, setNewColorInput] = useState('#6366f1');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    syncGoogleFontsToDocument(config.allowedFonts);
  }, [config.allowedFonts]);

  useEffect(() => {
    let active = true;
    void fetchRemoteSiteConfig().then((remote) => {
      if (active && remote) {
        setConfig(remote);
        setSavedConfig(remote);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const ok = await saveRemoteSiteConfig(config);
      applySiteConfigToDocument(config);
      if (ok) {
        setSavedConfig(config);
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
    const parsed = parseGoogleFontLink(newFontInput);
    if (!parsed) {
      setFontInputError(
        'Please enter a valid Google Fonts link (e.g. https://fonts.google.com/specimen/Agrave+Pro).'
      );
      return;
    }

    const alreadyExists = config.allowedFonts.some(
      (f) => f.toLowerCase() === parsed.family.toLowerCase()
    );
    if (alreadyExists) {
      setFontInputError(`"${parsed.family}" is already in the font list.`);
      return;
    }

    setFontInputError(null);
    setConfig((prev) => ({
      ...prev,
      allowedFonts: [...prev.allowedFonts, parsed.family],
    }));
    setNewFontInput('');
  };

  const handleFontDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setConfig((prev) => {
      const oldIndex = prev.allowedFonts.indexOf(String(active.id));
      const newIndex = prev.allowedFonts.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return {
        ...prev,
        allowedFonts: arrayMove(prev.allowedFonts, oldIndex, newIndex),
      };
    });
  };

  const removeFont = (fontToRemove: string) => {
    if (config.allowedFonts.length <= 1) {
      alert('At least one font must remain available.');
      return;
    }
    setConfig((prev) => {
      const remaining = prev.allowedFonts.filter((f) => f !== fontToRemove);
      return {
        ...prev,
        allowedFonts: remaining,
        defaultFont: prev.defaultFont === fontToRemove ? remaining[0] : prev.defaultFont,
      };
    });
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
    <div className="admin-root min-h-screen h-screen overflow-y-auto [scrollbar-gutter:stable] bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-800/80 bg-neutral-950/75 backdrop-blur-[22px] backdrop-saturate-[130%]">
        <div className="max-w-6xl mx-auto px-6 h-[72px] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="justify-self-start flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onExit}
              className="border-neutral-800 text-neutral-300 hover:text-white shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to App
            </Button>
            <div className="h-4 w-px bg-neutral-800 hidden md:block" />
            <div className="hidden md:flex items-center gap-2 truncate">
              <span className="font-semibold text-neutral-200 truncate">Developer Dashboard</span>
              <Badge variant="default" className="text-[10px] tracking-wide shrink-0">
                ADMIN
              </Badge>
            </div>
          </div>

          <div className="justify-self-center flex items-center gap-1 bg-neutral-900/90 border border-neutral-800 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Site Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-neutral-800 text-neutral-100 shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Analytics & Metrics</span>
            </button>
          </div>

          <div className="justify-self-end flex items-center gap-2.5">
            {activeTab === 'settings' && hasChanges && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 pb-24 space-y-6">
        {statusMessage && (
          <Alert variant={statusMessage.type === 'success' ? 'success' : 'destructive'}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <AlertTitle>{statusMessage.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
            <AlertDescription>{statusMessage.text}</AlertDescription>
          </Alert>
        )}

        {activeTab === 'analytics' ? (
          <AnalyticsView />
        ) : (
          <>
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
                    <label className="text-xs font-semibold text-neutral-300">
                      Favicon Icon URL
                    </label>
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
                      <label className="text-xs font-semibold text-neutral-300">
                        Default Accent
                      </label>
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
                            onChange={(e) =>
                              setConfig({ ...config, defaultColor1: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
                          />
                          <Input
                            value={config.defaultColor1}
                            onChange={(e) =>
                              setConfig({ ...config, defaultColor1: e.target.value })
                            }
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
                              onChange={(e) =>
                                setConfig({ ...config, defaultColor2: e.target.value })
                              }
                              className="w-8 h-8 rounded border border-neutral-700 bg-transparent cursor-pointer shrink-0"
                            />
                            <Input
                              value={config.defaultColor2}
                              onChange={(e) =>
                                setConfig({ ...config, defaultColor2: e.target.value })
                              }
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
                          setConfig({
                            ...config,
                            defaultFontSize: Number(e.target.value) as FontSize,
                          })
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
                  Configure the curated accent color swatches offered in the Appearance Settings
                  panel.
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
                        className="text-neutral-500 hover:text-red-400 ml-1 bg-transparent border-0 p-0 shadow-none transition-colors"
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
                  Drag fonts to reorder how they appear in user settings, or paste a Google Fonts
                  link to add a new font.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleFontDragEnd}
                >
                  <SortableContext items={config.allowedFonts} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {config.allowedFonts.map((font) => (
                        <SortableFontCard key={font} font={font} onRemove={removeFont} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="pt-2 space-y-1.5 max-w-xl">
                  <label className="text-xs font-semibold text-neutral-300">
                    Google Fonts Link
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Input
                      value={newFontInput}
                      onChange={(e) => {
                        setNewFontInput(e.target.value);
                        if (fontInputError) setFontInputError(null);
                      }}
                      placeholder="https://fonts.google.com/specimen/Agrave+Pro"
                      className="bg-neutral-950 border-neutral-800"
                      onKeyDown={(e) => e.key === 'Enter' && addFont()}
                    />
                    <Button size="sm" onClick={addFont} variant="secondary" className="shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Font
                    </Button>
                  </div>
                  {fontInputError ? (
                    <p className="text-[11px] text-red-400">{fontInputError}</p>
                  ) : (
                    <p className="text-[11px] text-neutral-500">
                      Paste a Google Fonts specimen or stylesheet link — the font name and styles
                      are extracted automatically.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
