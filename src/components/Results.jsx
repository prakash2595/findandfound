import { useState } from 'react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
    >
      {copied ? (
        <span>✓ Copied!</span>
      ) : (
        <span>📋 Copy JSON</span>
      )}
    </button>
  );
}

function Section({ title, children, count }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {count !== undefined && (
          <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm">
            {count} found
          </span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function OverviewTab({ data }) {
  return (
    <Section title="Foundation Information">
      <div className="space-y-4">
        <div>
          <label className="text-slate-500 text-sm">Foundation Name</label>
          <p className="text-white text-xl font-semibold mt-1">
            {data.foundation?.name || 'N/A'}
          </p>
        </div>
        <div>
          <label className="text-slate-500 text-sm">Website</label>
          <p className="mt-1">
            
              href={data.foundation?.website || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 break-all"
            >
              {data.foundation?.website || 'N/A'}
            </a>
          </p>
        </div>
        {data.foundation?.mission && (
          <div>
            <label className="text-slate-500 text-sm">Mission</label>
            <p className="text-slate-300 mt-1">{data.foundation.mission}</p>
          </div>
        )}
      </div>
    </Section>
  );
}

function EventsTab({ events }) {
  return (
    <Section title="Upcoming Events" count={events?.length || 0}>
      {events && events.length > 0 ? (
        <div className="space-y-4">
          {events.map((evt, i) => (
            <div
              key={i}
              className="p-4 bg-slate-700/50 rounded-xl border border-slate-600"
            >
              <h3 className="text-white font-semibold">{evt.name}</h3>
              <div className="flex items-center space-x-4 mt-2 text-sm">
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                  {evt.category}
                </span>
                {evt.date && (
                  <span className="text-slate-400">{evt.date}</span>
                )}
              </div>
              {evt.location && (
                <p className="text-slate-400 text-sm mt-2">{evt.location}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-center py-8">No events found</p>
      )}
    </Section>
  );
}

function ToolsTab({ tools }) {
  return (
    <Section title="Registration Tools" count={tools?.length || 0}>
      {tools && tools.length > 0 ? (
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
                    <span
                      className={
                        tool.registration_platform === 'UNKNOWN'
                          ? 'px-2 py-1 rounded text-xs bg-slate-600 text-slate-300'
                          : 'px-2 py-1 rounded text-xs bg-green-500/20 text-green-300'
                      }
                    >
                      {tool.registration_platform}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {tool.registration_link ? (
                      
                        href={tool.registration_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Link
                      </a>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </td>
                  <td className="py-3">
                    {tool.sponsorship_link ? (
                      
                        href={tool.sponsorship_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Link
                      </a>
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
    </Section>
  );
}

function TeamTab({ contacts }) {
  return (
    <Section title="Team Contacts" count={contacts?.length || 0}>
      {contacts && contacts.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {contacts.map((contact, i) => (
            <div
              key={i}
              className="p-4 bg-slate-700/50 rounded-xl border border-slate-600"
            >
              <h3 className="text-white font-semibold">{contact.name}</h3>
              <p className="text-blue-400 text-sm mt-1">{contact.title}</p>
              <div className="mt-3 space-y-1 text-sm text-slate-300">
                {contact.email && <p>{contact.email}</p>}
                {contact.phone && <p>{contact.phone}</p>}
                {contact.linkedin_url && (
                  
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 block"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-center py-8">No team contacts found</p>
      )}
    </Section>
  );
}

function JsonTab({ data }) {
  return (
    <Section title="Raw JSON Output">
      <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm text-slate-300 max-h-96">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Section>
  );
}

export default function Results({ data }) {
  const [activeTab, setActiveTab] = useState('overview');

  const eventsCount = data.events?.length || 0;
  const toolsCount = data.registration_tools?.length || 0;
  const teamCount = data.team_contacts?.length || 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: 'Events (' + eventsCount + ')' },
    { id: 'tools', label: 'Registration (' + toolsCount + ')' },
    { id: 'team', label: 'Team (' + teamCount + ')' },
    { id: 'json', label: 'Raw JSON' }
  ];

  const getTabClass = (tabId) => {
    if (activeTab === tabId) {
      return 'px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white';
    }
    return 'px-4 py-2 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={getTabClass(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton text={JSON.stringify(data, null, 2)} />
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'events' && <EventsTab events={data.events} />}
      {activeTab === 'tools' && <ToolsTab tools={data.registration_tools} />}
      {activeTab === 'team' && <TeamTab contacts={data.team_contacts} />}
      {activeTab === 'json' && <JsonTab data={data} />}
    </div>
  );
}
