import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const Dashboard = () => {
  const socket = useSocket();
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleNewIncident = (incident) => {
      console.log('New incident received via Socket.IO:', incident);
      setIncidents((prev) => [incident, ...prev]);
    };

    socket.on('newIncident', handleNewIncident);

    return () => {
      socket.off('newIncident', handleNewIncident);
    };
  }, [socket]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground mb-6">Real-time incident feed.</p>

      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="p-4 bg-zinc-900 rounded-md border border-zinc-800 text-zinc-400">
            Waiting for new incidents to be reported...
          </div>
        ) : (
          incidents.map((inc, i) => (
            <div key={inc._id || i} className="p-4 bg-zinc-900 rounded-md border border-zinc-800 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-red-400">{inc.title}</h3>
                <span className="text-xs px-2 py-1 bg-zinc-800 rounded uppercase">{inc.type}</span>
              </div>
              <p className="mt-2 text-zinc-300">{inc.description}</p>
              
              {inc.aiTriage && (
                <div className="mt-4 p-3 bg-blue-950/30 border border-blue-900/50 rounded text-sm">
                  <p className="font-semibold text-blue-400">AI Triage Summary:</p>
                  <p className="text-blue-200 mt-1">{inc.aiTriage.summary}</p>
                  <p className="text-blue-300 mt-1 text-xs">Risk Score: {inc.aiTriage.riskScore}/100 • Urgency: {inc.severity}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;
