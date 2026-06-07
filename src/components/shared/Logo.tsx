import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  return (
    <div className={`rounded-xl bg-white flex items-center justify-center text-white shadow-lg overflow-hidden ${sizeClasses[size]} ${className}`}>
      <img 
        src="/pwa-192x192.png" 
        alt="Vet Nexus" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};
