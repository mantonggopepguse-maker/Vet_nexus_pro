import React from 'react';
import { PawPrint } from 'lucide-react';

const PageLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm animate-fade-in">
            <div className="relative">
                {/* Bouncing Paws */}
                <div className="flex gap-3">
                    <PawPrint className="w-8 h-8 text-amber-500 animate-bounce delay-0" />
                    <PawPrint className="w-8 h-8 text-peach-500 animate-bounce delay-100" />
                    <PawPrint className="w-8 h-8 text-rose-500 animate-bounce delay-200" />
                </div>
                <p className="mt-4 text-sm font-bold text-slate-400 tracking-widest text-center uppercase animate-pulse">
                    Loading...
                </p>
            </div>
        </div>
    );
};

export default PageLoader;
