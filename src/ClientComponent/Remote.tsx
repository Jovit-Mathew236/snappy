import React, { useState } from "react";

const SnappyComponent = () => {
  const [selectedButton, setSelectedButton] = useState<string | null>(null);

  const handleButtonClick = (letter: string): void => {
    setSelectedButton(letter);
    console.log(`Button ${letter} clicked!`);
  };

  const buttons = ["A", "B", "C", "D", "E", "F"];
  const actionButtons = [
    {
      letter: "Y",
      color: "bg-emerald-500",
      hoverColor: "hover:bg-emerald-600",
    },
    { letter: "N", color: "bg-pink-500", hoverColor: "hover:bg-pink-600" },
  ];

  return (
    <div className="max-w-sm mx-auto bg-gradient-to-b from-yellow-300 to-yellow-400 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header with cute characters */}
      <div className="pt-8 pb-4 px-6">
        <div className="flex justify-center items-center space-x-4 mb-6">
          {/* Blue sad character */}
          <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center">
            <div className="text-lg">😢</div>
          </div>

          {/* Separator lines */}
          <div className="flex flex-col space-y-1">
            <div className="w-6 h-0.5 bg-gray-600"></div>
            <div className="w-6 h-0.5 bg-gray-600"></div>
          </div>
        </div>

        {/* Pink and yellow happy characters */}
        <div className="flex justify-center space-x-8 mb-8">
          {/* Pink happy character */}
          <div className="w-16 h-20 bg-pink-400 rounded-full flex items-center justify-center relative">
            <div className="text-xl">😊</div>
          </div>

          {/* Yellow happy character */}
          <div className="w-16 h-20 bg-yellow-500 rounded-full flex items-center justify-center relative">
            <div className="text-xl">😄</div>
          </div>
        </div>
      </div>

      {/* Main buttons grid */}
      <div className="px-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {buttons.map((letter) => (
            <button
              key={letter}
              onClick={() => handleButtonClick(letter)}
              className={`w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center text-2xl font-bold text-gray-800 transition-all duration-200 transform hover:scale-105 hover:shadow-xl active:scale-95 ${
                selectedButton === letter
                  ? "ring-4 ring-blue-400 bg-blue-50"
                  : ""
              }`}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center space-x-6 pb-6">
          {actionButtons.map((btn) => (
            <button
              key={btn.letter}
              onClick={() => handleButtonClick(btn.letter)}
              className={`w-20 h-20 rounded-full ${btn.color} ${
                btn.hoverColor
              } shadow-lg flex items-center justify-center text-2xl font-bold text-white transition-all duration-200 transform hover:scale-105 hover:shadow-xl active:scale-95 ${
                selectedButton === btn.letter ? "ring-4 ring-white" : ""
              }`}
            >
              {btn.letter}
            </button>
          ))}
        </div>
      </div>

      {/* Snappy text */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 py-3">
        <h1 className="text-center text-3xl font-bold text-white tracking-wider">
          snappy
        </h1>
      </div>
    </div>
  );
};

export default SnappyComponent;
