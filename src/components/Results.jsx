import { useState } from 'react';

export default function Results({ data }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderOverview = () => {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Foundation Information</h2>
        <div className="space-y-4">
          <div>
            <p className="text-slate-500 text-sm">Foundation Name</p>
            <p className="text-white text-xl font-semibold">{data.foundation?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-sm">Website</p>
            
              href={data.foundation?.website || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 break-all"
            >
              {data.foundation?.website || 'N/A'}
            </a>
          </div>
          {data.foundation?.mission && (
            <div>
              <p className="text-slate-500 text-sm">Mission</p>
              <p className="text-slate-300">{data.foundation.mission}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEvents = () => {
    const events = data.events || [];
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Upcoming Events</h2>
          <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">{events.length} found</span>
        </div>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.map((evt, i) => (
              <div key={i} className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                <h3 className="text-white font-semibold">{evt.name}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">{evt.category}</span>
                  {evt.date && <span className="text-slate-400">{evt.date}</span>}
                </div>
                {evt.location && <p className="text-slate-400 text-sm mt-2">{evt.location}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No events found</p>
        )}
      </div>
    );
  };

  const renderTools = () => {
    const tools = data.registration_tools || [];
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Registration Tools</h2>
          <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">{tools.length} found</span>
        </div>
        {tools.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 pr-4">Event</th>
                  <th className="pb-3 pr-4">Platform</th>
                  <th className="pb-3 pr-4">Registration</th>
                  <th className="pb-3">Sponsorship</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-3 pr-4 text-white">{tool.event_name}</td>
                    <td className="py-3 pr-4">
                      <span className={tool.registration_platform === 'UNKNOWN' ? 'px-2 py-1 rounded text-xs bg-slate-600 text-slate-300' : 'px-2 py-1 rounded text-xs bg-green-500/20 text-green-300'}>
                        {tool.registration_platform}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {tool.registration_link ? (
                        <a href={tool.registration_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Link</a>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="py-3">
                      {tool.sponsorship_link ? (
                        <a href={tool.sponsorship_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Link</a>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No registration tools found</p>
        )}
      </div>
    );
  };

  const renderTeam = () => {
    const contacts = data.team_contacts || [];
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Team Contacts</h2>
          <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">{contacts.length} found</span>
        </div>
        {contacts.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {contacts.map((contact, i) => (
              <div key={i} className="p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                <h3 className="text-white font-semibold">{contact.name}</h3>
                <p className="text-blue-400 text-sm mt-1">{contact.title}</p>
                <div className="mt-3 space-y-1 text-sm text-slate-300">
                  {contact.email && <p>{contact.email}</p>}
                  {contact.phone && <p>{contact.phone}</p>}
                  {contact.linkedin_url && (
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 block">LinkedIn</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No team contacts found</p>
        )}
      </div>
    );
  };

  const renderJson = () => {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Raw JSON Output</h2>
        <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm text-slate-300 max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const eventsCount = data.events?.length || 0;
  const toolsCount = data.registration_tools?.length || 0;
  const teamCount = data.team_contacts?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={activeTab === 'overview' ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700'}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={activeTab === 'events' ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700'}
          >
            Events ({eventsCount})
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={activeTab === 'tools' ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700'}
          >
            Registration ({toolsCount})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={activeTab === 'team' ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700'}
          >
            Team ({teamCount})
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={activeTab === 'json' ? 'px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700'}
          >
            Raw JSON
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
        >
          <span>{copied ? '✓ Copied!' : '📋 Copy JSON'}</span>
        </button>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'events' && renderEvents()}
      {activeTab === 'tools' && renderTools()}
      {activeTab === 'team' && renderTeam()}
      {activeTab === 'json' && renderJson()}
    </div>
  );
}
