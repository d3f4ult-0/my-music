import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Heart, WifiOff, Library } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 py-1.5 text-[10px] font-medium transition-colors ${
      isActive ? 'text-primary' : 'text-neutral-400 hover:text-neutral-200'
    }`;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface border-t border-border-subtle z-40 flex items-center justify-around select-none">
      <NavLink to="/" end className={navClass}>
        <Home size={19} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/search" className={navClass}>
        <Search size={19} />
        <span>Search</span>
      </NavLink>
      <NavLink to="/favorites" className={navClass}>
        <Heart size={19} />
        <span>Favorites</span>
      </NavLink>
      <NavLink to="/playlists" className={navClass}>
        <Library size={19} />
        <span>Playlists</span>
      </NavLink>
      <NavLink to="/offline" className={navClass}>
        <WifiOff size={19} />
        <span>Offline</span>
      </NavLink>
    </nav>
  );
};
