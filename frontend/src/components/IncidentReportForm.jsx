import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import axios from 'axios';

const containerStyle = {
  width: '100%',
  height: '300px'
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629 // Default to center of India, adjust as needed
};

const incidentSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  type: z.enum([
    'fire', 'flood', 'earthquake', 'cyclone', 'landslide', 
    'accident', 'medical_emergency', 'building_collapse', 
    'chemical_spill', 'riot', 'other'
  ]),
  locationAddress: z.string().min(3, "Please enter an address or search for a location"),
  latitude: z.number({ required_error: "Latitude is required" }),
  longitude: z.number({ required_error: "Longitude is required" })
});

const IncidentReportForm = () => {
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);

  // Load Google Maps API
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      type: 'other'
    }
  });

  const handleMapClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
    setValue('latitude', lat, { shouldValidate: true });
    setValue('longitude', lng, { shouldValidate: true });

    // Reverse geocode if needed, but for now we just save coordinates
    // Setting a dummy address so Zod doesn't complain if user just clicks map
    if (!getValues('locationAddress')) {
      setValue('locationAddress', `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`, { shouldValidate: true });
    }
  };

  const handleGeocode = () => {
    const address = getValues('locationAddress');
    if (!address) return;

    if (!window.google) {
      alert("Google Maps is not loaded yet");
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        
        setMapCenter({ lat, lng });
        setMarkerPosition({ lat, lng });
        
        setValue('latitude', lat, { shouldValidate: true });
        setValue('longitude', lng, { shouldValidate: true });
        setValue('locationAddress', results[0].formatted_address, { shouldValidate: true });
      } else {
        alert("Geocode was not successful: " + status);
      }
    });
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('type', data.type);
      
      const locationObj = {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
        address: data.locationAddress
      };
      formData.append('location', JSON.stringify(locationObj));

      // Append files
      mediaFiles.forEach(file => {
        formData.append('media', file);
      });

      // Assuming standard Bearer token auth in your app (fetch from your state/context)
      const token = localStorage.getItem('token') || ''; 

      const response = await axios.post('http://localhost:5000/api/report', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setSubmitMessage({ type: 'success', text: 'Incident reported successfully!' });
      }
    } catch (error) {
      console.error(error);
      setSubmitMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Error reporting incident. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100 mt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Report an Incident</h2>
      
      {submitMessage && (
        <div className={`p-4 mb-6 rounded-md ${submitMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {submitMessage.text}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Incident Title</label>
          <input 
            type="text" 
            {...register('title')} 
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Major Flooding on Main St"
          />
          {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea 
            {...register('description')} 
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Provide details about the incident, affected people, etc."
          ></textarea>
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Incident Type</label>
          <select 
            {...register('type')} 
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="fire">Fire</option>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="cyclone">Cyclone</option>
            <option value="landslide">Landslide</option>
            <option value="accident">Accident</option>
            <option value="medical_emergency">Medical Emergency</option>
            <option value="building_collapse">Building Collapse</option>
            <option value="chemical_spill">Chemical Spill</option>
            <option value="riot">Riot</option>
            <option value="other">Other</option>
          </select>
          {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
        </div>

        {/* Location & Map */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          
          <div className="flex space-x-2 mb-4">
            <input 
              type="text" 
              {...register('locationAddress')} 
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter address or landmark"
            />
            <button 
              type="button" 
              onClick={handleGeocode}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Search
            </button>
          </div>
          {errors.locationAddress && <p className="text-red-500 text-sm mt-1 mb-2">{errors.locationAddress.message}</p>}

          <p className="text-xs text-gray-500 mb-2">Or click on the map to set the exact location:</p>
          
          <div className="rounded-md overflow-hidden border border-gray-300">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapCenter}
                zoom={10}
                onClick={handleMapClick}
              >
                {markerPosition && (
                  <Marker position={markerPosition} />
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-[300px] flex items-center justify-center bg-gray-200 text-gray-500">
                Loading Map...
              </div>
            )}
          </div>
          {(errors.latitude || errors.longitude) && (
            <p className="text-red-500 text-sm mt-2">Please select a location on the map or search for an address.</p>
          )}
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attach Media (Images/Videos)</label>
          <input 
            type="file" 
            multiple 
            accept="image/*,video/*,.pdf"
            onChange={(e) => setMediaFiles(Array.from(e.target.files))}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">You can upload up to 5 files.</p>
        </div>

        {/* Submit */}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full py-3 px-4 text-white rounded-md font-semibold text-lg transition ${
            isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? 'Submitting Report...' : 'Submit Incident Report'}
        </button>
      </form>
    </div>
  );
};

export default IncidentReportForm;
