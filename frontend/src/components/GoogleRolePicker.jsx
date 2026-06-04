import { Shield } from 'lucide-react';

/**
 * Modal shown when a brand-new Google user has no account yet.
 * The backend returns `{ requiresRole: true }` and the frontend
 * renders this picker before re-calling the Google auth endpoint
 * with the chosen role.
 */
const GoogleRolePicker = ({ onSelect, onCancel, isSubmitting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 shadow-2xl animate-scale-in">

      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-red-600/20 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-red-400" />
        </div>
        <h2 className="text-base font-black text-zinc-100">How will you use ResQAI?</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
        Choose your role. This is set once during account creation and cannot be changed from the app.
      </p>

      <div className="space-y-2.5">
        <button
          onClick={() => onSelect('citizen')}
          disabled={isSubmitting}
          className="w-full flex items-start gap-3.5 p-4 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 rounded-xl text-left transition-all duration-200 disabled:opacity-50 group"
        >
          <span className="text-2xl leading-none mt-0.5">🏠</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-100 group-hover:text-blue-300 transition-colors">Citizen</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Report emergencies, find shelters, request help, and track nearby incidents.
            </p>
          </div>
        </button>

        <button
          onClick={() => onSelect('responder')}
          disabled={isSubmitting}
          className="w-full flex items-start gap-3.5 p-4 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700 hover:border-green-500/50 rounded-xl text-left transition-all duration-200 disabled:opacity-50 group"
        >
          <span className="text-2xl leading-none mt-0.5">🚑</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-100 group-hover:text-green-300 transition-colors">Emergency Responder</p>
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
              Accept and respond to incidents, manage resource requests, coordinate with your team.
            </p>
          </div>
        </button>
      </div>

      <button
        onClick={onCancel}
        disabled={isSubmitting}
        className="mt-4 w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1.5"
      >
        Cancel — use email sign-up instead
      </button>
    </div>
  </div>
);

export default GoogleRolePicker;
