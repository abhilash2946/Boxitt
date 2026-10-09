import React, { useEffect, useState, useMemo } from 'react';
import ArenaCard from '../components/ArenaCard';
import { locationService } from '../services/locationService';
import { userService } from '../services/userService';
import { Location, UserProfile } from '../types';
import { calculateDistance } from '../services/distanceUtils';

const ArenaListPage: React.FC = () => {
  const [arenas, setArenas] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let timeoutId: any;
    const fetchProfile = () => {
      userService.getCurrentUserProfile()
        .then(res => {
          if (res.profile) {
            setUserProfile(res.profile);
            // If we have profile but no coordinates, retry once after a delay
            // (AuthProvider might be updating them right now)
            if (res.profile.latitude === null || res.profile.latitude === undefined) {
              timeoutId = setTimeout(fetchProfile, 3000);
            }
          }
        })
        .catch(console.error);
    };

    fetchProfile();
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    locationService.getLocations()
      .then((data) => {
        setArenas(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching arenas:", err);
        setLoading(false);
      });
  }, []);

  const sortedArenas = useMemo(() => {
    return [...arenas].sort((a, b) => {
      const distA = calculateDistance(userProfile?.latitude, userProfile?.longitude, a.latitude, a.longitude);
      const distB = calculateDistance(userProfile?.latitude, userProfile?.longitude, b.latitude, b.longitude);

      if (distA === distB) return 0;
      if (distA === Infinity) return 1;
      if (distB === Infinity) return -1;
      return distA - distB;
    });
  }, [arenas, userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-12 md:h-12 border-[1vw] md:border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[95vw] md:max-w-7xl mx-auto p-[var(--fluid-padding)] md:p-8 mb-[20vw] md:mb-12">
      <h1 className="text-[var(--font-title)] md:text-4xl font-black italic uppercase tracking-tighter mb-[var(--fluid-padding)] md:mb-10 text-text-primary">
        Available Arenas
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--fluid-padding)] md:gap-8">
        {sortedArenas.map((arena) => (
          <ArenaCard
            key={arena.id}
            arena={arena}
            userLat={userProfile?.latitude}
            userLon={userProfile?.longitude}
          />
        ))}
        {sortedArenas.length === 0 && (
          <div className="col-span-full text-center py-[20vw] md:py-20 bg-card rounded-[var(--fluid-radius)] md:rounded-[2.5rem] border-[0.5vw] md:border-2 border-dashed border-border">
            <p className="font-black uppercase tracking-widest text-text-disabled text-[3vw] md:text-sm">No arenas found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArenaListPage;
