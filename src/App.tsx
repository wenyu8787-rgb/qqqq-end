/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {useState, useRef, useEffect, useCallback} from 'react';
import confetti from 'canvas-confetti';
import {db} from './firebase';
import {collection, addDoc, query, orderBy, onSnapshot} from 'firebase/firestore';

export default function App() {
  const [participants, setParticipants] = useState<string[]>(
    Array.from({length: 10}, (_, i) => (i + 1).toString())
  );
  const [inputValue, setInputValue] = useState(participants.join(', '));
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<{winner: string; timestamp: number}[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'spinResults'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as {winner: string; timestamp: number});
      setHistory(data);
    });
    return () => unsubscribe();
  }, []);

  const addToHistory = async (winner: string) => {
    try {
      await addDoc(collection(db, 'spinResults'), {
        winner,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error adding result to firebase: ', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    ctx.clearRect(0, 0, width, height);

    const sliceAngle = (2 * Math.PI) / participants.length;
    participants.forEach((p, i) => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, rotation + i * sliceAngle, rotation + (i + 1) * sliceAngle);
      ctx.closePath();
      
      // Use different bright colors
      const hue = (i * 360) / participants.length;
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fill();
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation + i * sliceAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(p, radius - 10, 5);
      ctx.restore();
    });
  }, [participants]);

  useEffect(() => {
    drawWheel(0);
  }, [drawWheel]);

  const spin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinner(null);

    const duration = 5000;
    const startTime = performance.now();
    const startRotation = rotationRef.current;
    const extraRotations = 5 + Math.random() * 5;
    const totalRotation = startRotation + Math.PI * 2 * extraRotations;
    const winningIndex = Math.floor(Math.random() * participants.length);
    const targetRotation = totalRotation - (winningIndex * (2 * Math.PI) / participants.length + Math.PI / participants.length);

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (targetRotation - startRotation) * easeProgress;
      
      rotationRef.current = currentRotation;
      drawWheel(currentRotation % (2 * Math.PI));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const result = participants[winningIndex];
        setIsSpinning(false);
        setWinner(result);
        addToHistory(result);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: {y: 0.6}
        });
      }
    }
    requestAnimationFrame(animate);
  };

  const handleUpdateParticipants = () => {
    const newParticipants = inputValue.split(',').map(s => s.trim()).filter(Boolean);
    if (newParticipants.length > 0) {
      setParticipants(newParticipants);
      rotationRef.current = 0;
      drawWheel(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Dynamic Spin Wheel</h1>
      
      <div className="mb-6 flex gap-2 w-full max-w-md">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded"
          placeholder="Comma separated names"
        />
        <button 
          onClick={handleUpdateParticipants}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Update
        </button>
      </div>

      <div className="relative">
        <div className="absolute top-[-20px] left-1/2 transform -translate-x-1/2 text-red-500 text-4xl">▼</div>
        <canvas ref={canvasRef} width={400} height={400} className="border-4 border-gray-200 rounded-full" />
      </div>

      <button 
        id="start-button"
        onClick={spin}
        disabled={isSpinning}
        className="mt-8 bg-green-500 text-white text-xl font-bold py-4 px-12 rounded-full hover:bg-green-600 disabled:bg-gray-400"
      >
        {isSpinning ? 'Spinning...' : 'Start Spin'}
      </button>

      {winner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center">
            <h2 className="text-2xl font-bold mb-4">Winner!</h2>
            <p className="text-6xl font-extrabold text-green-600">{winner}</p>
            <button 
              onClick={() => setWinner(null)}
              className="mt-6 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Spin History</h2>
        <ul className="bg-white rounded shadow p-4 max-h-60 overflow-y-auto">
          {history.map((entry, index) => (
            <li key={index} className="border-b last:border-b-0 py-2 flex justify-between">
              <span className="font-semibold">{entry.winner}</span>
              <span className="text-gray-500 text-sm">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </li>
          ))}
          {history.length === 0 && <li className="text-gray-400">No history yet.</li>}
        </ul>
      </div>
    </div>
  );
}

