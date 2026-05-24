import { ArrowLeft, AlertTriangle, Shield, Zap, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import IncidentReportForm from '../components/IncidentReportForm';

// ── Info chips shown at the top of the page ────────────────────────────────────
const chips = [
  { icon: Zap,           text: 'AI-triaged instantly',       color: 'text-blue-400  bg-blue-500/10  border-blue-500/20'  },
  { icon: Shield,        text: 'Dispatches responders',      color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  { icon: Clock,         text: 'Live status updates',        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
];

const Report = () => (
  <div className="min-h-screen bg-zinc-950 text-zinc-100">
    {/* Ambient glow — top */}
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-72 bg-red-600/6 rounded-full blur-3xl pointer-events-none" />
    <div className="fixed top-0 right-0 w-64 h-64 bg-orange-600/4 rounded-full blur-3xl pointer-events-none" />

    {/* ── Sticky header ──────────────────────────────────────────────────────── */}
    <header className="sticky top-0 z-50 flex items-center gap-3 px-4 sm:px-6 py-3 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
      <Link
        to="/home"
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition px-2.5 py-1.5 rounded-lg hover:bg-zinc-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Home
      </Link>

      <div className="h-4 w-px bg-zinc-700/60" />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/50">
          <AlertTriangle className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-zinc-100">Report Incident</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        <span className="text-[10px] text-zinc-500 hidden sm:block">Live submission</span>
      </div>
    </header>

    <div className="relative max-w-2xl mx-auto px-4 py-8">

      {/* ── Page hero ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-zinc-950 flex items-center justify-center">
              <span className="text-[8px] text-white font-black">!</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-black text-zinc-100 leading-tight">
              Report an Emergency
            </h1>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
              Describe the situation and set the location. Our AI will triage your report and dispatch the nearest available responders.
            </p>
          </div>
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {chips.map(({ icon: Icon, text, color }) => (
            <div
              key={text}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${color}`}
            >
              <Icon className="w-3 h-3" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-8" />

      {/* ── The actual form ──────────────────────────────────────────────────── */}
      <IncidentReportForm />

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-zinc-700 mt-8">
        False reports undermine emergency response. Please only submit genuine emergencies.
      </p>
    </div>
  </div>
);

export default Report;
