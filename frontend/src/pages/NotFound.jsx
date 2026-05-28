import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth, roleHome } from '../context/AuthContext';

const NotFound = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 animate-fade-up">
      {/* Dot pattern */}
      <div className="absolute inset-0 hero-dots opacity-60 pointer-events-none" />
      {/* Glow blob */}
      <div className="absolute w-[500px] h-[500px] bg-red-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center max-w-md">
        {/* Icon */}
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto mb-6 shadow-xl shadow-red-500/10">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* 404 */}
        <h1 className="text-[7rem] font-black leading-none select-none mb-1"
          style={{ color: 'transparent', WebkitTextStroke: '2px rgba(63,63,70,0.8)' }}>
          404
        </h1>

        <h2 className="text-2xl font-black tracking-tight text-zinc-200 mb-3">Page not found</h2>
        <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.<br />
          Let's get you back to safety.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 hover:border-zinc-600 text-sm font-semibold transition-all duration-200 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Go back
          </button>
          <button
            onClick={() => navigate(user ? roleHome(user.role) : '/login')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-600/25"
          >
            <Home className="w-4 h-4" /> Go home
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="absolute bottom-8 flex items-center gap-2 text-zinc-700 text-xs">
        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-red-500/60 to-red-700/60 flex items-center justify-center text-[9px] font-black text-white">R</div>
        <span>ResQ<span className="text-red-500/60">AI</span> Emergency Platform</span>
      </div>
    </div>
  );
};

export default NotFound;
