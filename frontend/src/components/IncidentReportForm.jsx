import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import * as z from 'zod';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, Upload, X, MapPin, CheckCircle2, Loader2, ImageIcon } from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAP_CONTAINER_STYLE = { width: '100%', height: '280px' };
const DEFAULT_CENTER      = { lat: 20.5937, lng: 78.9629 };
const MAX_FILES           = 5;
const MAX_FILE_MB         = 10;
const ALLOWED_TYPES       = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm','application/pdf'];

const INCIDENT_TYPES = [
  { value: 'fire',               label: '🔥 Fire' },
  { value: 'flood',              label: '🌊 Flood' },
  { value: 'earthquake',         label: '🌍 Earthquake' },
  { value: 'cyclone',            label: '🌀 Cyclone' },
  { value: 'landslide',          label: '⛰️ Landslide' },
  { value: 'accident',           label: '🚗 Accident' },
  { value: 'medical_emergency',  label: '🚑 Medical Emergency' },
  { value: 'building_collapse',  label: '🏚️ Building Collapse' },
  { value: 'chemical_spill',     label: '☣️ Chemical Spill' },
  { value: 'riot',               label: '🚨 Riot' },
  { value: 'other',              label: '📌 Other' },
];

// ── Validation schema ──────────────────────────────────────────────────────────

const schema = z.object({
  title:           z.string().min(5,  'Title must be at least 5 characters'),
  description:     z.string().min(10, 'Description must be at least 10 characters'),
  type:            z.enum(['fire','flood','earthquake','cyclone','landslide','accident','medical_emergency','building_collapse','chemical_spill','riot','other']),
  locationAddress: z.string().min(3,  'Please enter or search for an address'),
  latitude:        z.number({ required_error: 'Select a location on the map' }),
  longitude:       z.number({ required_error: 'Select a location on the map' }),
});

// ── Sub-component: media preview card ─────────────────────────────────────────

const MediaPreview = ({ file, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const url     = URL.createObjectURL(file);
  const sizeMB  = (file.size / (1024 * 1024)).toFixed(1);

  return (
    <div className="relative group rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800">
      {isImage ? (
        <img
          src={url}
          alt={file.name}
          className="w-full h-24 object-cover"
          onLoad={() => URL.revokeObjectURL(url)}
        />
      ) : (
        <div className="w-full h-24 flex flex-col items-center justify-center gap-1 text-zinc-400">
          <ImageIcon className="w-7 h-7" />
          <span className="text-[10px] text-center px-1 leading-tight truncate w-full text-center">{file.name}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300 flex justify-between">
        <span className="truncate max-w-[80%]">{file.name}</span>
        <span>{sizeMB} MB</span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(file)}
        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove file"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const IncidentReportForm = () => {
  const { api } = useAuth();
  const navigate = useNavigate();

  const [mapCenter,      setMapCenter]      = useState(DEFAULT_CENTER);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [mediaFiles,     setMediaFiles]     = useState([]);
  const [fileError,      setFileError]      = useState('');
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [submitMessage,  setSubmitMessage]  = useState(null); // { type, text }
  const [dragOver,       setDragOver]       = useState(false);

  // Load Google Maps
  const { isLoaded } = useJsApiLoader({
    id:              'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({
    resolver:      zodResolver(schema),
    defaultValues: { type: 'other' },
  });

  // ── Map handlers ─────────────────────────────────────────────────────────────

  const handleMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
    setValue('latitude',  lat, { shouldValidate: true });
    setValue('longitude', lng, { shouldValidate: true });
    if (!getValues('locationAddress')) {
      setValue('locationAddress', `${lat.toFixed(5)}, ${lng.toFixed(5)}`, { shouldValidate: true });
    }
  }, [setValue, getValues]);

  const handleGeocode = () => {
    const address = getValues('locationAddress');
    if (!address) return;
    if (!window.google) { alert('Google Maps not loaded yet'); return; }

    new window.google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        setMapCenter({ lat, lng });
        setMarkerPosition({ lat, lng });
        setValue('latitude',        lat,                              { shouldValidate: true });
        setValue('longitude',       lng,                              { shouldValidate: true });
        setValue('locationAddress', results[0].formatted_address,    { shouldValidate: true });
      } else {
        setSubmitMessage({ type: 'error', text: `Geocoding failed: ${status}` });
      }
    });
  };

  // ── File validation ───────────────────────────────────────────────────────────

  const validateAndAddFiles = (incoming) => {
    setFileError('');
    const newFiles = Array.from(incoming);
    const combined = [...mediaFiles, ...newFiles];

    if (combined.length > MAX_FILES) {
      setFileError(`You can only upload up to ${MAX_FILES} files.`);
      return;
    }

    const invalid = newFiles.filter(f => !ALLOWED_TYPES.includes(f.type));
    if (invalid.length) {
      setFileError(`Unsupported file type: ${invalid.map(f => f.type).join(', ')}`);
      return;
    }

    const tooBig = newFiles.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) {
      setFileError(`File(s) exceed ${MAX_FILE_MB} MB limit: ${tooBig.map(f => f.name).join(', ')}`);
      return;
    }

    setMediaFiles(combined);
  };

  const removeFile = (fileToRemove) => {
    setMediaFiles(prev => prev.filter(f => f !== fileToRemove));
    setFileError('');
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const formData = new FormData();
      formData.append('title',       data.title);
      formData.append('description', data.description);
      formData.append('type',        data.type);
      formData.append('location', JSON.stringify({
        type:        'Point',
        coordinates: [data.longitude, data.latitude],
        address:     data.locationAddress,
      }));
      mediaFiles.forEach(file => formData.append('media', file));

      // Use AuthContext api instance (token injected automatically)
      const response = await api.post('/report', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setSubmitMessage({ type: 'success', text: 'Incident reported successfully! AI triage is processing…' });
        reset();
        setMediaFiles([]);
        setMarkerPosition(null);
        setMapCenter(DEFAULT_CENTER);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (error) {
      console.error('[IncidentReportForm] submit error:', error);
      setSubmitMessage({
        type: 'error',
        text: error.response?.data?.message || 'Error reporting incident. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Report an Incident
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Your report will be triaged by AI and dispatched to responders immediately.
        </p>
      </div>

      {/* Submit feedback */}
      {submitMessage && (
        <div className={`flex items-start gap-3 p-4 mb-5 rounded-xl border text-sm font-medium ${
          submitMessage.type === 'success'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {submitMessage.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          }
          {submitMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

        {/* ── Title ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Incident Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            {...register('title')}
            placeholder="e.g. Major flooding on MG Road"
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
          />
          {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* ── Description ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            {...register('description')}
            rows={4}
            placeholder="Describe the incident in detail — number of people affected, immediate hazards, etc."
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm resize-none"
          />
          {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
        </div>

        {/* ── Incident Type ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Incident Type <span className="text-red-400">*</span>
          </label>
          <select
            {...register('type')}
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
          >
            {INCIDENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type.message}</p>}
        </div>

        {/* ── Location ── */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
          <label className="block text-sm font-medium text-zinc-300 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-400" />
            Location <span className="text-red-400">*</span>
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              {...register('locationAddress')}
              placeholder="Enter address or landmark"
              className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
            />
            <button
              type="button"
              onClick={handleGeocode}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition shrink-0"
            >
              Search
            </button>
          </div>

          {errors.locationAddress && (
            <p className="text-red-400 text-xs">{errors.locationAddress.message}</p>
          )}

          <p className="text-xs text-zinc-500">Or click on the map to set the exact location:</p>

          <div className="rounded-lg overflow-hidden border border-zinc-700">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={mapCenter}
                zoom={5}
                onClick={handleMapClick}
                options={{
                  styles: [{ elementType: 'geometry', stylers: [{ color: '#1d2127' }] }, { elementType: 'labels.text.fill', stylers: [{ color: '#8a9099' }] }],
                  mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
                }}
              >
                {markerPosition && <Marker position={markerPosition} />}
              </GoogleMap>
            ) : (
              <div className="w-full h-[280px] flex items-center justify-center bg-zinc-900 text-zinc-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Map…
              </div>
            )}
          </div>

          {(errors.latitude || errors.longitude) && (
            <p className="text-red-400 text-xs">Please select a location on the map or search for an address.</p>
          )}

          {markerPosition && (
            <p className="text-xs text-blue-400">
              📍 Selected: {markerPosition.lat.toFixed(5)}, {markerPosition.lng.toFixed(5)}
            </p>
          )}
        </div>

        {/* ── Media Upload ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-zinc-400" />
            Attach Media
            <span className="text-zinc-500 font-normal">(optional — up to {MAX_FILES} files, {MAX_FILE_MB} MB each)</span>
          </label>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); validateAndAddFiles(e.dataTransfer.files); }}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center transition ${
              dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500'
            }`}
          >
            <Upload className="w-7 h-7 text-zinc-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">
              Drag & drop images/videos/PDF here, or{' '}
              <label className="text-blue-400 hover:text-blue-300 cursor-pointer underline underline-offset-2">
                browse
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf"
                  className="hidden"
                  onChange={e => { validateAndAddFiles(e.target.files); e.target.value = ''; }}
                />
              </label>
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              JPG, PNG, WebP, GIF, MP4, MOV, WebM, PDF — max {MAX_FILE_MB} MB each
            </p>
          </div>

          {fileError && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {fileError}
            </p>
          )}

          {/* Previews */}
          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
              {mediaFiles.map((file, i) => (
                <MediaPreview key={`${file.name}-${i}`} file={file} onRemove={removeFile} />
              ))}
            </div>
          )}

          {mediaFiles.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1.5">
              {mediaFiles.length} / {MAX_FILES} file{mediaFiles.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting || !!fileError}
          className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Report…</>
          ) : (
            <><AlertTriangle className="w-4 h-4" /> Submit Incident Report</>
          )}
        </button>
      </form>
    </div>
  );
};

export default IncidentReportForm;
