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
        <svg
          className="w-4 h-4 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
      <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
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

export default function Results({ data }) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: 'Events (' + (data.events?.length || 0) + ')' },
    { id: 'tools', label: 'Registration (' + (data.registration_tools?.length || 0) + ')' },
    { id: 'team', label: 'Team (' + (data.team_contacts?.length || 0) + ')' },
    { id: 'json', label: 'Raw JSON' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                (activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton text={JSON.stringify(data, null, 2)} />
      </div>

      {activeTab === 'overview' && (
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
              
                href={data.foundation?.website || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 block mt-1 break-all"
              >
                {data.foundation?.website || 'N/A'}
              </a>
            </div>
            {data.foundation?.mission && (
              <div>
                <label className="text-slate-500 text-sm">Mission</label>
                <p className="text-slate-300 mt-1">{data.foundation.mission}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {activeTab === 'events' && (
        <Section title="Upcoming Events" count={data.events?.length || 0}>
          {data.events?.length > 0 ? (
            <div className="space-y-4">
              {data.events.map((evt, i) => (
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
      )}

      {activeTab === 'tools' && (
        <Section title="Registration Tools" count={data.registration_tools?.length || 0}>
          {data.registration_tools?.length > 0 ? (
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
                  {data.registration_tools.map((tool, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-3 pr-4 text-white">{tool.event_name}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            'px-2 py-1 rounded text-xs ' +
                            (tool.registration_platform === 'UNKNOWN'
                              ? 'bg-slate-600 text-slate-300'
                              : 'bg-green-500/20 text-green-300')
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
      )}

      {activeTab === 'team' && (
        <Section title="Team Contacts" count={data.team_contacts?.length || 0}>
          {data.team_contacts?.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {data.team_contacts.map((contact, i) => (
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
      )}

      {activeTab === 'json' && (
        <Section title="Raw JSON Output">
          <pre className="bg-slate-900 rounded-xl p-4 overflow-x-auto text-sm text-slate-300 max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}
