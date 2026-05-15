import Incident from '../models/Incident.js';

// Controller to handle media upload for an existing incident
export const uploadIncidentMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find incident
    const incident = await Incident.findById(id);

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No media files uploaded' });
    }

    // Process uploaded files
    const newMedia = req.files.map(file => {
      // Determine type based on mimetype
      let type = 'image';
      if (file.mimetype.startsWith('video/')) type = 'video';
      else if (file.mimetype.startsWith('audio/')) type = 'audio';
      else if (file.mimetype.includes('pdf')) type = 'document';

      return {
        url: file.path,
        publicId: file.filename,
        type: type,
        caption: req.body.caption || ''
      };
    });

    // Add media to incident
    incident.media.push(...newMedia);
    await incident.save();

    res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      media: incident.media
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ success: false, message: 'Server error while uploading media' });
  }
};
