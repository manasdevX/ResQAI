import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth, roleHome } from '../context/AuthContext';
import {
  AlertTriangle, Upload, X, MapPin, CheckCircle2,
  Loader2, ImageIcon, Navigation, RotateCcw, Zap,
  ChevronRight, ChevronLeft, Send,
} from 'lucide-react';
import { INCIDENT_TYPES } from '../constants/incident';

// ── Fix Leaflet default icon paths (Vite build issue) ─────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = [20.5937, 78.9629]; // India centre
const MAX_FILES      = 5;
const MAX_FILE_MB    = 10;
const ALLOWED_TYPES  = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf',
];

// Two steps: 1 = What, 2 = Where + Media
const STEPS = ['Incident Details', 'Location & Media'];

// ── Sub-component: click handler inside map ────────────────────────────────────
function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── Custom red marker for selected point ───────────────────────────────────────
const redIcon = new L.Icon({
  iconUrl:       'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize:     [25, 41],
  iconAnchor:   [12, 41],
  popupAnchor:  [1, -34],
  shadowSize:   [41, 41],
});

// ── Sub-component: media preview card ─────────────────────────────────────────
const MediaPreview = ({ file, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const sizeMB  = (file.size / (1024 * 1024)).toFixed(1);
  const url     = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800 aspect-square">
      {isImage ? (
        <img src={url} alt={file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-500 p-2">
          <ImageIcon className="w-8 h-8" />
          <span className="text-[10px] text-center leading-tight line-clamp-2">{file.name}</span>
        </div>
      )}
      {/* Overlay info */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1">
        <span className="text-[9px] text-zinc-300">{sizeMB} MB</span>
      </div>
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file)}
        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-lg"
        title="Remove file"
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  );
};

// ── Step indicator ─────────────────────────────────────────────────────────────
const StepIndicator = ({ step }) => (
  <div className="flex items-center gap-2 mb-6">
    {STEPS.map((label, i) => {
      const idx     = i + 1;
      const active  = step === idx;
      const done    = step > idx;
      return (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className={`flex items-center gap-2 flex-1 ${active ? '' : 'opacity-50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
              done    ? 'bg-green-500 text-white' :
              active  ? 'bg-red-600 text-white ring-2 ring-red-600/30' :
                        'bg-zinc-800 border border-zinc-700 text-zinc-500'
            }`}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx}
            </div>
            <span className={`text-xs font-semibold truncate ${active ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 mx-1 transition-all ${done ? 'bg-green-500/50' : 'bg-zinc-700'}`} />
          )}
        </div>
      );
    })}
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const IncidentReportForm = ({ onSuccess }) => {
  const { api, user } = useAuth();
  const navigate      = useNavigate();

  // Multi-step state
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [type,        setType]        = useState('other');

  // Step 2 fields
  const [lat,     setLat]     = useState(null);
  const [lng,     setLng]     = useState(null);
  const [address, setAddress] = useState('');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [locating,  setLocating]  = useState(false);
  const [locError,  setLocError]  = useState('');

  // Media
  const [mediaFiles, setMediaFiles] = useState([]);
  const [fileError,  setFileError]  = useState('');
  const [dragOver,   setDragOver]   = useState(false);

  // Submit
  const [submitting,  setSubmitting]  = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Validation errors
  const [step1Errors, setStep1Errors] = useState({});
  const [step2Error,  setStep2Error]  = useState('');

  const mapRef = useRef(null);

  // ── GPS auto-detect ──────────────────────────────────────────────────────────
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setMapCenter([latitude, longitude]);
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setLocating(false);
        setStep2Error('');
        // Pan map
        if (mapRef.current) mapRef.current.setView([latitude, longitude], 14);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === 1
            ? 'Location access denied. Please allow location or click the map.'
            : 'Unable to get your location. Please click the map to set it.'
        );
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Auto-detect on mount (silent — no error shown if denied)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setMapCenter([latitude, longitude]);
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      },
      () => {}, // silent fail
      { timeout: 6000, maximumAge: 120000 }
    );
  }, []);

  // ── Map click ────────────────────────────────────────────────────────────────
  const handleMapPick = useCallback((pickedLat, pickedLng) => {
    setLat(pickedLat);
    setLng(pickedLng);
    setAddress(`${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}`);
    setStep2Error('');
    setLocError('');
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────────
  const validateAndAddFiles = useCallback((incoming) => {
    setFileError('');
    const newFiles = Array.from(incoming);
    const combined = [...mediaFiles, ...newFiles];

    if (combined.length > MAX_FILES) {
      setFileError(`Max ${MAX_FILES} files allowed.`);
      return;
    }
    const invalid = newFiles.filter(f => !ALLOWED_TYPES.includes(f.type));
    if (invalid.length) {
      setFileError(`Unsupported type: ${invalid.map(f => f.type || f.name).join(', ')}`);
      return;
    }
    const tooBig = newFiles.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) {
      setFileError(`File(s) exceed ${MAX_FILE_MB} MB: ${tooBig.map(f => f.name).join(', ')}`);
      return;
    }
    setMediaFiles(combined);
  }, [mediaFiles]);

  const removeFile = useCallback((fileToRemove) => {
    setMediaFiles(prev => prev.filter(f => f !== fileToRemove));
    setFileError('');
  }, []);

  // ── Step 1 validation ─────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const errs = {};
    if (!title.trim() || title.trim().length < 5)
      errs.title = 'Title must be at least 5 characters.';
    if (!description.trim() || description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters.';
    setStep1Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep2Error('');
    setSubmitError('');

    if (!lat || !lng) {
      setStep2Error('Please set the incident location on the map or use GPS.');
      return;
    }

    setSubmitting(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('title',       title.trim());
      formData.append('description', description.trim());
      formData.append('type',        type);
      formData.append('location', JSON.stringify({
        type:        'Point',
        coordinates: [lng, lat],
        address:     address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      }));
      mediaFiles.forEach(file => formData.append('media', file));

      await api.post('/report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      setSubmitted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => navigate(roleHome(user?.role)), 3000);
    } catch (err) {
      console.error('[IncidentReportForm] submit error:', err);
      setSubmitError(
        err.response?.data?.message || 'Failed to submit report. Please try again.'
      );
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5">
        {/* Animated check */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
          <div className="absolute inset-0 rounded-full bg-green-500/5 animate-ping" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-zinc-100">Report Submitted!</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Your incident has been reported and is being processed by AI triage.
            Responders will be dispatched shortly.
          </p>
        </div>

        {/* AI triage badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/40 border border-blue-800/40 rounded-full">
          <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span className="text-xs text-blue-300 font-medium">AI triage processing…</span>
        </div>

        <p className="text-xs text-zinc-600">Redirecting to home in a moment…</p>
      </div>
    );
  }

  // ── Render form ───────────────────────────────────────────────────────────────
  return (
    <div>
      <StepIndicator step={step} />

      {/* ── STEP 1: Incident Details ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Incident Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setStep1Errors(p => ({ ...p, title: '' })); }}
              placeholder="e.g. Major flooding on MG Road near Station"
              className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition text-sm ${
                step1Errors.title
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                  : 'border-zinc-700 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            {step1Errors.title && (
              <p className="flex items-center gap-1 text-red-400 text-xs mt-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {step1Errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); setStep1Errors(p => ({ ...p, description: '' })); }}
              rows={4}
              placeholder="Describe the emergency in detail — number of people affected, hazards present, what help is needed…"
              className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition text-sm resize-none ${
                step1Errors.description
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                  : 'border-zinc-700 focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
            <div className="flex justify-between items-center mt-1">
              {step1Errors.description ? (
                <p className="flex items-center gap-1 text-red-400 text-xs">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {step1Errors.description}
                </p>
              ) : (
                <span />
              )}
              <span className={`text-xs ml-auto ${description.length < 10 ? 'text-zinc-600' : 'text-zinc-500'}`}>
                {description.length} chars
              </span>
            </div>
          </div>

          {/* Incident Type — visual grid */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Incident Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {INCIDENT_TYPES.map(({ value, label }) => {
                const [icon, ...rest] = label.split(' ');
                const text = rest.join(' ');
                const isSelected = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-red-600/20 border-red-500/60 text-red-300 ring-1 ring-red-500/30'
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-xl leading-none">{icon}</span>
                    <span className="text-[10px] font-semibold leading-tight">{text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={goToStep2}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-red-900/30"
          >
            Continue — Set Location <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 2: Location & Media ─────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Location section */}
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-800/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                Incident Location <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 rounded-lg text-xs font-semibold transition disabled:opacity-60"
              >
                {locating
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Navigation className="w-3 h-3" />
                }
                {locating ? 'Detecting…' : 'Use My GPS'}
              </button>
            </div>

            {locError && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-950/30 border border-amber-800/30 rounded-lg text-amber-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {locError}
              </div>
            )}

            {/* Leaflet Map */}
            <div className="rounded-xl overflow-hidden border border-zinc-700" style={{ height: '280px' }}>
              <MapContainer
                center={mapCenter}
                zoom={lat ? 13 : 5}
                style={{ width: '100%', height: '100%' }}
                ref={mapRef}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPick={handleMapPick} />
                {lat && lng && (
                  <Marker position={[lat, lng]} icon={redIcon} />
                )}
              </MapContainer>
            </div>

            <p className="text-[11px] text-zinc-500 text-center">
              {lat && lng
                ? <span className="text-blue-400 font-medium">📍 {lat.toFixed(5)}, {lng.toFixed(5)} — tap map to adjust</span>
                : 'Click anywhere on the map to set the incident location, or use GPS above'
              }
            </p>

            {step2Error && (
              <p className="flex items-center gap-1.5 text-red-400 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {step2Error}
              </p>
            )}
          </div>

          {/* Media upload */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              <Upload className="w-3.5 h-3.5" />
              Attach Photos / Videos
              <span className="text-zinc-600 font-normal normal-case ml-1">(optional, up to {MAX_FILES})</span>
            </label>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); validateAndAddFiles(e.dataTransfer.files); }}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-blue-500 bg-blue-500/10'
                  : mediaFiles.length > 0
                    ? 'border-zinc-600 bg-zinc-800/20'
                    : 'border-zinc-700 bg-zinc-800/20 hover:border-zinc-500 hover:bg-zinc-800/40'
              }`}
            >
              <label className="absolute inset-0 cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf"
                  className="hidden"
                  onChange={e => { validateAndAddFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
              <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-blue-400' : 'text-zinc-600'}`} />
              <p className="text-sm text-zinc-400 pointer-events-none">
                Drag & drop or <span className="text-blue-400 underline">browse files</span>
              </p>
              <p className="text-xs text-zinc-600 mt-1 pointer-events-none">
                Images, videos, PDF — max {MAX_FILE_MB} MB each
              </p>
            </div>

            {fileError && (
              <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {fileError}
              </p>
            )}

            {/* Previews */}
            {mediaFiles.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-500">
                    {mediaFiles.length} / {MAX_FILES} file{mediaFiles.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => { setMediaFiles([]); setFileError(''); }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear all
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {mediaFiles.map((file, i) => (
                    <MediaPreview key={`${file.name}-${i}`} file={file} onRemove={removeFile} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {submitting && progress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {progress < 100 ? 'Uploading media…' : 'Processing with AI…'}
                </span>
                <span className="font-bold tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* AI triage note */}
          <div className="flex items-center gap-2.5 p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-xs text-blue-300/80 leading-relaxed">
              Your report will be instantly <strong className="text-blue-300">AI-triaged</strong> and dispatched to available responders based on type and location.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep(1); setStep2Error(''); setSubmitError(''); }}
              className="flex items-center gap-1.5 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-xl font-semibold text-sm transition"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="submit"
              disabled={submitting || !!fileError}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition shadow-lg shadow-red-900/30"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progress > 0 && progress < 100 ? `Uploading ${progress}%…` : 'Submitting…'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Incident Report
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default IncidentReportForm;
