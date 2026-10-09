import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Location } from '../types';
import { MoreVertical, Info, Star, MapPin } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { calculateDistance, formatDistance } from '../services/distanceUtils';

export interface ArenaCardProps {
  arena: Location;
  userLat?: number;
  userLon?: number;
}

const ArenaCard: React.FC<ArenaCardProps> = ({ arena, userLat, userLon }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme } = useTheme();

  const distance = useMemo(() => {
    const d = calculateDistance(userLat, userLon, arena.latitude, arena.longitude);
    return d === Infinity ? null : d;
  }, [userLat, userLon, arena.latitude, arena.longitude]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div
      className="relative group transition-all duration-300 hover:translate-y-[-1vw] md:hover:translate-y-[-4px]"
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 'clamp(16px, 4vw, 28px)',
        boxShadow: theme.elevation.card,
        border: `2px solid ${theme.colors.border}`
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-[clamp(16px, 4vw, 28px)]">
        <img
          src={arena.imageUrls[0] || 'https://via.placeholder.com/400x300?text=No+Image'}
          alt={arena.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* Status Badge */}
        <div className="absolute top-[3vw] md:top-3 left-[3vw] md:left-3 z-30 px-[3vw] md:px-3 py-[1.5vw] md:py-1 rounded-full border shadow-lg backdrop-blur-md"
             style={{
               backgroundColor: arena.is_open ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
               borderColor: 'rgba(255, 255, 255, 0.2)'
             }}>
          <span className="text-white font-black text-[2.5vw] md:text-[10px] uppercase tracking-widest">
            {arena.is_open ? 'Open' : 'Closed'}
          </span>
        </div>

        {/* Dropdown Menu */}
        <div className="absolute top-[3vw] md:top-3 right-[3vw] md:right-3 z-30" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
            className="p-[2vw] md:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors border border-gray-100"
            aria-label="More options"
          >
            <MoreVertical className="w-[5vw] md:w-5 h-[5vw] md:h-5 text-gray-800" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-[2vw] md:mt-2 w-[48vw] md:w-48 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right"
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: '12px',
                boxShadow: theme.elevation.modal,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <button
                className="flex items-center gap-[3vw] md:gap-3 w-full text-left px-[4vw] md:px-4 py-[3vw] md:py-3 hover:bg-background-secondary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(false);
                  navigate(`/arena/${arena.id}`);
                }}
              >
                <Info className="w-[4vw] md:w-4 h-[4vw] md:h-4 text-accent" />
                <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-primary">About details</span>
              </button>
            </div>
          )}
        </div>

        {/* Price Badge */}
        <div className="absolute bottom-[3vw] md:bottom-3 left-[3vw] md:left-3 px-[3vw] md:px-3 py-[1.5vw] md:py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/20">
          <span className="text-white font-black text-[3vw] md:text-xs">
            {arena.defaultPrice && arena.defaultPrice > 0 ? `₹${arena.defaultPrice}` : 'No prices yet'}
          </span>
        </div>
      </div>

      <div className="p-[5vw] md:p-5 space-y-[3vw] md:space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="font-black text-[4.5vw] md:text-xl italic uppercase tracking-tighter text-text-primary leading-tight">
            {arena.name}
          </h3>
          <div className="flex items-center gap-[2vw] md:gap-2">
            {distance !== null && (
              <div className="bg-accent/10 px-[2vw] md:px-2 py-[0.5vw] md:py-0.5 rounded-full">
                <span className="text-[2.5vw] md:text-xs font-black text-accent">{formatDistance(distance)}</span>
              </div>
            )}
            {arena.rating ? (
              <div className="flex items-center gap-[1vw] md:gap-1 bg-success/10 px-[2vw] md:px-2 py-[0.5vw] md:py-0.5 rounded-full">
                <Star className="w-[3vw] md:w-3 h-[3vw] md:h-3 text-success fill-success" />
                <span className="text-[2.5vw] md:text-xs font-black text-success">{arena.rating}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-[2vw] md:gap-2 text-text-secondary">
          <MapPin className="w-[3vw] md:w-3 h-[3vw] md:h-3 text-accent" />
          <span className="text-[2.5vw] md:text-xs font-bold uppercase tracking-wide dynamic-text">
            {arena.address}
          </span>
        </div>

        <button
          onClick={() => navigate(`/arena/${arena.id}`)}
          className="w-full py-[3vw] md:py-3 mt-[2vw] md:mt-2 bg-background-secondary hover:bg-accent hover:text-white transition-all duration-300 rounded-[3vw] md:rounded-xl font-black uppercase tracking-widest text-[2.5vw] md:text-xs border border-border group-hover:border-accent"
        >
          Book Now
        </button>
      </div>
    </div>
  );
};

export default ArenaCard;
