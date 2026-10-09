import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';

interface ImageEditorModalProps {
    imageUrl: string;
    onSave: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
}

export default function ImageEditorModal({ imageUrl, onSave, onCancel }: ImageEditorModalProps) {
    const { theme } = useTheme();
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1));
    }

    const handleSave = async () => {
        if (!completedCrop || !imgRef.current || !previewCanvasRef.current) return;
        const image = imgRef.current;
        const canvas = previewCanvasRef.current;
        const crop = completedCrop;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pixelRatio = window.devicePixelRatio;
        canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
        canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
        ctx.scale(pixelRatio, pixelRatio);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width * scaleX, crop.height * scaleY);
        canvas.toBlob((blob) => { if (blob) onSave(blob); }, 'image/jpeg', 0.9);
    };

    return (
        <div className="fixed inset-0 z-[70] flex flex-col backdrop-blur-xl transition-all duration-300"
             style={{ backgroundColor: `${theme.colors.background}F2` }}>
            <div className="flex justify-between items-center p-4 sm:p-6 border-b shadow-theme-card" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <button onClick={onCancel} className="p-2 rounded-full transition-all shadow-theme-card active:scale-95 border" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textDisabled }}>
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <span className="font-black uppercase tracking-widest text-xs sm:text-sm" style={{ color: theme.colors.textPrimary }}>Adjust Photo</span>
                <button onClick={handleSave} className="p-2 rounded-full transition-all shadow-theme-card active:scale-95 border" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.accent }}>
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden relative">
                <div className="max-h-[60vh] sm:max-h-[70vh] max-w-full overflow-hidden flex items-center justify-center relative shadow-theme-modal border p-2"
                     style={{ borderRadius: theme.radius.large, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
                    <ReactCrop crop={crop} onChange={(_, c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={1} circularCrop>
                        <img ref={imgRef} alt="Crop" src={imageUrl} onLoad={onImageLoad} className="max-h-[50vh] sm:max-h-[60vh] object-contain" />
                    </ReactCrop>
                </div>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] mt-6 sm:mt-8 text-center px-4" style={{ color: theme.colors.textDisabled }}>
                    Drag to reposition • Circular crop applied
                </p>
                <canvas ref={previewCanvasRef} className="hidden" />
            </div>

            <div className="p-4 sm:p-8 flex justify-center gap-4 border-t shadow-theme-elevated" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.card }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave}
                               className="w-full max-w-sm py-4 sm:py-5 text-white rounded-theme-md font-black uppercase tracking-widest text-xs sm:text-sm shadow-theme-elevated transition-all active:translate-y-1"
                               style={{ backgroundColor: theme.colors.accent }}>
                    Save Changes
                </motion.button>
            </div>
        </div>
    );
}
