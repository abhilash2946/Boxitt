import React from 'react';
import DashboardNavbar from './components/DashboardNavbar';
import { User } from './types';

interface DashboardNavbarWrapperProps {
  user: User;
  onAdminClick?: () => void;
  onSuperAdminClick?: () => void;
  onProfileClick?: () => void;
  onBackClick?: () => void;
}

const DashboardNavbarWrapper: React.FC<DashboardNavbarWrapperProps> = ({ user, onAdminClick, onSuperAdminClick, onProfileClick, onBackClick }) => {
  return (
    <DashboardNavbar
      user={user}
      onAdminClick={onAdminClick}
      onProfileClick={onProfileClick}
      onBackClick={onBackClick}
    />
  );
};

export default DashboardNavbarWrapper;
