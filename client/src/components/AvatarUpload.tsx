// src/components/AvatarUpload.tsx
import React, { useState, ChangeEvent, FC } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface AvatarUploadProps {
  value: string | null;
  onChange: (avatar: string | null) => void;
  defaultImage: string;
}

/**
 * AvatarUpload - Profile avatar upload component
 *
 * Features:
 * - File picker for image upload
 * - Image preview
 * - 1MB file size limit
 * - Base64 encoding for IndexedDB storage
 * - WCAG-compliant 44px touch targets
 */
const AvatarUpload: FC<AvatarUploadProps> = ({ value, onChange, defaultImage }) => {
  const { t, tString } = useTranslation();
  const [preview, setPreview] = useState<string>(value || defaultImage);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type — allow raster formats only (SVG blocked for stored-XSS prevention)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert(t('entry.invalidFileType'));
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      alert(t('entry.avatarTooLarge'));
      return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onChange(base64);
    };
    reader.onerror = () => {
      console.error('FileReader failed:', reader.error);
      alert(tString('entry.invalidFileType', 'Please select an image file'));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="avatar-upload">
      <label className="avatar-upload-label" title={tString('entry.changeAvatar', 'Change Avatar')}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="avatar-input"
          aria-label={tString('entry.changeAvatar', 'Change Avatar')}
        />
        <div className="avatar-preview">
          <img src={preview} alt={tString('entry.avatarAlt', 'Profile Avatar')} />
          <div className="avatar-overlay">
            <svg className="camera-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17C14.2091 17 16 15.2091 16 13C16 10.7909 14.2091 9 12 9C9.79086 9 8 10.7909 8 13C8 15.2091 9.79086 17 12 17Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </label>
    </div>
  );
};

export default AvatarUpload;
