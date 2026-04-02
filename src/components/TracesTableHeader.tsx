'use client';

// Extract timezone abbreviation for the column header, e.g. "PST" or "GMT+8".
// toLocaleTimeString with timeZoneName:'short' returns something like "3:45:12 PM PST";
// splitting on spaces and taking the last token gives just the tz abbreviation.
const tzAbbr = new Date().toLocaleTimeString([], { timeZoneName: 'short' }).split(' ').at(-1);

export const TracesTableHeader = () => (
  <div className="grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide shrink-0">
    <span>Status</span>
    <span>Route</span>
    <span className="text-right">ms</span>
    <span className="text-right">Code</span>
    <span className="text-right">Env</span>
    <span className="text-right">Time ({tzAbbr})</span>
  </div>
);
