import { useEffect, useState } from 'react';
import { CITIES, PROV } from '../lib/data.js';
import { getProviders } from '../api.js';
import { track } from '../lib/track.js';
import { Back } from './Icons.jsx';

const mapLink = (p) => 'https://maps.google.com/?q=' + encodeURIComponent(p.name + ', ' + p.address + ', Nigeria');

// Screen 5: listing only (no booking, no calling). Filtered by city and plan category.
export default function Providers({ cat, city, setCity, onBack }) {
  const info = PROV[cat] || PROV.gyn;
  const [data, setData] = useState({ loading: true, items: [], fallback: false, failed: false });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true, failed: false }));
    getProviders(city, cat)
      .then((r) => {
        if (cancelled) return;
        setData({ loading: false, items: r.providers, fallback: r.fallback, failed: false });
        track('provider_view', { category: cat, city });
      })
      .catch(() => { if (!cancelled) setData({ loading: false, items: [], fallback: false, failed: true }); });
    return () => { cancelled = true; };
  }, [city, cat]);

  return (
    <div className="screen">
      <header className="prov-header">
        <button className="back-btn" onClick={onBack} aria-label="Back to plan"><Back />My plan</button>
        <img className="logo" src="/brand/lockup-aubergine.png" alt="Closa Health" />
      </header>
      <main className="prov-main">
        <div className="prov-intro">
          <div className="city-block">
            <span className="eyebrow">Your location</span>
            <div className="pills">
              {CITIES.map((c) => (
                <button key={c} className={'pill' + (c === city ? ' on' : '')} aria-pressed={c === city} onClick={() => setCity(c)}>{c}</button>
              ))}
            </div>
          </div>
          <h2>{info.heading}</h2>
          <p>{info.intro}</p>
        </div>

        <div className="prov-grid">
          {data.loading && <p className="loading">Finding places in {city}…</p>}
          {data.failed && <p className="full">We couldn’t load the list just now. Please try again in a moment.</p>}
          {data.fallback && !data.loading && (
            <p className="full">We don’t have a dedicated listing for this in {city} yet, so here are hospitals that can see you and refer you on.</p>
          )}
          {!data.loading && data.items.map((p) => (
            <div key={p.id} className="prov">
              <div className="prov-top">
                <div><h3>{p.name}</h3><p className="kind">{p.kind}</p></div>
                <span className="area">{p.area}</span>
              </div>
              {p.note && <p>{p.note}</p>}
              <span className="addr">{p.address}</span>
              <a className="btn btn-outline" href={mapLink(p)} target="_blank" rel="noopener noreferrer" onClick={() => track('directions_tap', { category: cat, city })}>Get directions</a>
            </div>
          ))}
          <div className="guide">
            <span className="label-sm">Choosing someone else?</span>
            <h3>{info.guide.title}</h3>
            <ul>{info.guide.points.map((t) => <li key={t}><span>—</span><span>{t}</span></li>)}</ul>
          </div>
        </div>
      </main>
    </div>
  );
}
