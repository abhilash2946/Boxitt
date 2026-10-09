import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

interface ImageViewerProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ images, initialIndex, isOpen, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const { theme } = useTheme();

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, isOpen]);

  // Body Scroll Lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, index]);

  const next = (e?: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setIndex((prevIdx) => (prevIdx < images.length - 1 ? prevIdx + 1 : prevIdx));
  };

  const prev = (e?: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setIndex((prevIdx) => (prevIdx > 0 ? prevIdx - 1 : prevIdx));
  };

  if (!isOpen || images.length === 0) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-black/98 backdrop-blur-3xl flex items-center justify-center overflow-hidden select-none"
          onClick={onClose}
        >
          {/* Close Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 md:top-8 md:right-8 p-3 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all z-[1100] border border-white/20 active:scale-90 shadow-2xl"
          >
            <X className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          {/* Navigation - Left */}
          {images.length > 1 && (
            <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 flex items-center justify-center z-[1050]">
              <button
                onClick={(e) => { e.stopPropagation(); prev(e); }}
                disabled={index === 0}
                className={`p-4 md:p-6 rounded-full bg-white/5 hover:bg-white/20 text-white transition-all border border-white/5 items-center justify-center active:scale-90 ${index === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronLeft className="w-8 h-8 md:w-12 md:h-12" />
              </button>
            </div>
          )}

          {/* Main Image Container - Full Screen Sizing */}
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 1.05, x: -50 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-full h-full flex items-center justify-center p-2 md:p-8"
              >
                <img
                  src={images[index]}
                  alt={`Image ${index + 1}`}
                  className="w-full h-full max-w-full max-h-full rounded-2xl md:rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] object-contain border border-white/5"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation - Right */}
          {images.length > 1 && (
            <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 flex items-center justify-center z-[1050]">
              <button
                onClick={(e) => { e.stopPropagation(); next(e); }}
                disabled={index === images.length - 1}
                className={`p-4 md:p-6 rounded-full bg-white/5 hover:bg-white/20 text-white transition-all border border-white/5 items-center justify-center active:scale-90 ${index === images.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronRight className="w-8 h-8 md:w-12 md:h-12" />
              </button>
            </div>
          )}

          {/* Footer Info */}
          <div className="absolute bottom-6 md:bottom-10 left-0 right-0 flex flex-col items-center gap-4 md:gap-6 z-[1050] pointer-events-none">
            <div className="px-8 py-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
              <span className="text-white font-black text-sm md:text-base uppercase tracking-[0.4em]">
                {index + 1} <span className="opacity-30 mx-3">/</span> {images.length}
              </span>
            </div>

            {/* Dots for visual indicator */}
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                    className={`h-2 rounded-full transition-all duration-500 pointer-events-auto ${i === index ? 'w-10 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]' : 'w-2 bg-white/20 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Swipe Detection overlay for mobile/touch */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            onDragEnd={(_, info) => {
              const swipeThreshold = 50;
              if (info.offset.x < -swipeThreshold) next();
              else if (info.offset.x > swipeThreshold) prev();
            }}
            className="absolute inset-0 z-[1005] cursor-grab active:cursor-grabbing sm:hidden"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ImageViewer;
