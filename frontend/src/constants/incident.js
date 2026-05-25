export const INCIDENT_TYPES = [
  { value: 'fire',               label: '🔥 Fire' },
  { value: 'flood',              label: '🌊 Flood' },
  { value: 'earthquake',         label: '🌍 Earthquake' },
  { value: 'cyclone',            label: '🌀 Cyclone' },
  { value: 'landslide',          label: '🏔️ Landslide' },
  { value: 'accident',           label: '🚗 Accident' },
  { value: 'medical_emergency',  label: '🚑 Medical Emergency' },
  { value: 'building_collapse',  label: '🏚️ Building Collapse' },
  { value: 'chemical_spill',     label: '☣️ Chemical Spill' },
  { value: 'riot',               label: '⚠️ Riot' },
  { value: 'other',              label: '📍 Other' },
];

export const TYPE_ICONS = {
  fire:               '🔥',
  flood:              '🌊',
  earthquake:         '🌍',
  cyclone:            '🌀',
  landslide:          '🏔️',
  accident:           '🚗',
  medical_emergency:  '🚑',
  building_collapse:  '🏚️',
  chemical_spill:     '☣️',
  riot:               '⚠️',
  other:              '📍',
};

// Tailwind badge/chip classes
export const SEVERITY_BADGE = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:      'text-green-400 bg-green-500/10 border-green-500/30',
};

// Single bg-color class for dots and thin accent bars
export const SEVERITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-green-500',
};

// { bar, text, bg } for analytics chart bars
export const SEVERITY_BAR = {
  critical: { bar: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  high:     { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  medium:   { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  low:      { bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30' },
};

// Hex colors for Google Maps markers
export const SEVERITY_HEX = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

// { label, color } for incident status badge/chip display
export const INCIDENT_STATUS = {
  reported:     { label: 'Reported',     color: 'bg-zinc-700/60 text-zinc-300' },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-500/20 text-blue-400' },
  responding:   { label: 'Responding',   color: 'bg-yellow-500/20 text-yellow-400' },
  resolved:     { label: 'Resolved',     color: 'bg-green-500/20 text-green-400' },
  closed:       { label: 'Closed',       color: 'bg-zinc-600/30 text-zinc-500' },
  false_alarm:  { label: 'False Alarm',  color: 'bg-zinc-700/40 text-zinc-400' },
};

// { bar, text } for analytics chart bars
export const INCIDENT_STATUS_BAR = {
  reported:     { bar: 'bg-zinc-500',   text: 'text-zinc-400' },
  acknowledged: { bar: 'bg-blue-500',   text: 'text-blue-400' },
  responding:   { bar: 'bg-yellow-500', text: 'text-yellow-400' },
  resolved:     { bar: 'bg-green-500',  text: 'text-green-400' },
  closed:       { bar: 'bg-zinc-600',   text: 'text-zinc-500' },
  false_alarm:  { bar: 'bg-zinc-700',   text: 'text-zinc-400' },
};
