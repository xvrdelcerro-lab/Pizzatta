"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="fixed inset-y-0 right-0 left-64 overflow-hidden bg-white">
      {/* Main Content Centered properly */}
      <div className="w-full h-full flex flex-col items-center justify-center max-w-4xl mx-auto px-4">
        {/* Logo Image */}
        <div className="mb-6 flex justify-center w-full">
          <img 
            src="/logo.png" 
            alt="Pizzatta Logo" 
            className="max-w-md w-full h-auto object-contain"
          />
        </div>

        {/* Date and Time Display */}
        <div className="text-center font-bold text-[#548235]">
          <p className="text-xl tracking-wide">{formatDate(currentTime)}</p>
          <p className="text-2xl mt-1">{formatTime(currentTime)}</p>
        </div>
      </div>

      {/* Bottom Left Label anchored cleanly to this container */}
      <div className="absolute bottom-4 left-4 text-xs font-semibold text-gray-500 z-10">
        
      </div>
    </div>
  );
}