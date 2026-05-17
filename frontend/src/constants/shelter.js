import { Zap, Wifi, Heart, Baby, Accessibility, BedDouble, Droplets, UtensilsCrossed } from 'lucide-react';

export const SHELTER_TYPE_OPTIONS = [
  { value: 'hospital',            label: 'Hospital' },
  { value: 'relief_camp',         label: 'Relief Camp' },
  { value: 'school',              label: 'School' },
  { value: 'community_hall',      label: 'Community Hall' },
  { value: 'government_building', label: 'Govt Building' },
  { value: 'warehouse',           label: 'Warehouse' },
  { value: 'other',               label: 'Other' },
];

export const SHELTER_STATUS_OPTIONS = ['active', 'preparing', 'full', 'closed'];

// Full metadata for each shelter type (label + emoji icon + Tailwind badge color)
export const SHELTER_TYPE_META = {
  hospital:            { label: 'Hospital',      icon: '🏥', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  relief_camp:         { label: 'Relief Camp',   icon: '⛺', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  school:              { label: 'School',        icon: '🏫', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  community_hall:      { label: 'Comm. Hall',    icon: '🏛️', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  government_building: { label: 'Govt Building', icon: '🏢', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  warehouse:           { label: 'Warehouse',     icon: '🏭', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  other:               { label: 'Other',         icon: '📍', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
};

// Tailwind badge/chip classes for shelter status
export const SHELTER_STATUS_BADGE = {
  active:    'bg-green-500/15 text-green-400 border-green-500/30',
  full:      'bg-red-500/15 text-red-400 border-red-500/30',
  preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  closed:    'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

// Hex fill/stroke for Google Maps shelter markers
export const SHELTER_STATUS_HEX = {
  active:    { fill: '#22c55e', stroke: '#16a34a' },
  full:      { fill: '#f97316', stroke: '#ea580c' },
  preparing: { fill: '#3b82f6', stroke: '#2563eb' },
  closed:    { fill: '#6b7280', stroke: '#4b5563' },
};

export const AMENITIES = [
  { key: 'food',                icon: UtensilsCrossed, label: 'Food' },
  { key: 'water',               icon: Droplets,        label: 'Water' },
  { key: 'medical',             icon: Heart,           label: 'Medical' },
  { key: 'electricity',         icon: Zap,             label: 'Power' },
  { key: 'wifi',                icon: Wifi,            label: 'WiFi' },
  { key: 'bedding',             icon: BedDouble,       label: 'Beds' },
  { key: 'childCare',           icon: Baby,            label: 'Child Care' },
  { key: 'wheelchairAccessible',icon: Accessibility,   label: 'Accessible' },
];
