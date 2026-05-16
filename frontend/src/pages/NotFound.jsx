import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 page-enter">
      {/* Glow blob */}
      <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center max-w-md">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-8xl font-black text-zinc-800 mb-2 leading-none select-none">404</h1>
        <h2 className="text-2xl font-bold text-zinc-200 mb-3">Page not found</h2>
        <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.<br />
          Let's get you back to safety.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-red-600/20"
          >
            <Home className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>

      {/* ResQAI branding */}
      <div className="absolute bottom-8 flex items-center gap-2 text-zinc-700 text-xs">
        <div className="w-5 h-5 rounded-full bg-red-600/50 flex items-center justify-center text-[10px] font-bold text-white">R</div>
        ResQAI Emergency Platform
      </div>
    </div>
  );
};

export default NotFound;
