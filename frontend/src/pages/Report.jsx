import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import IncidentReportForm from '../components/IncidentReportForm';

const Report = () => (
  <div className="min-h-screen bg-zinc-950 text-zinc-100 page-enter">
    {/* Ambient glow */}
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

    {/* Header */}
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 py-3 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
      <Link
        to="/home"
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition px-2 py-1.5 rounded-lg hover:bg-zinc-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Home
      </Link>
      <div className="h-4 w-px bg-zinc-700" />
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
          <AlertTriangle className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Report Incident</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-[10px] text-zinc-500">Live submission</span>
      </div>
    </header>

    {/* Form */}
    <div className="relative max-w-2xl mx-auto px-4 py-8">
      <IncidentReportForm />
    </div>
  </div>
);

export default Report;
