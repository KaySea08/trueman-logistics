import { useState } from 'react';
import { ArrowRight, PackageSearch, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3000/api/v1';

type TrackingEvent = {
  status: string;
  locationLabel: string | null;
  notes: string | null;
  source: string;
  occurredAt: string;
};

type TrackingResponse = {
  shipmentNumber: string;
  status: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery: string | null;
  origin: { city: string; countryCode: string } | null;
  destination: { city: string; countryCode: string } | null;
  recentEvents: TrackingEvent[];
};

export default function TrackingForm({ compact = false }: { compact?: boolean }) {
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = reference.trim();
    if (!cleaned) {
      setError('');
      setMessage('Enter your tracking reference to continue.');
      setResult(null);
      return;
    }

    setBusy(true);
    setMessage('');
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API}/tracking/${encodeURIComponent(cleaned)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to find that shipment.');
      }

      setResult(data);
      setMessage('Tracking lookup complete.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load shipment tracking.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.form
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`tracking-form ${compact ? 'tracking-compact' : ''}`}
        onSubmit={submit}
      >
        <div className="tracking-icon"><PackageSearch size={23}/></div>
        <div className="tracking-copy"><strong>Track your shipment</strong><span>Enter the reference issued for your shipment</span></div>
        <label className="sr-only" htmlFor={compact ? 'tracking-compact' : 'tracking-main'}>Tracking reference</label>
        <input id={compact ? 'tracking-compact' : 'tracking-main'} value={reference} onChange={e => { setReference(e.target.value); setMessage(''); setError(''); }} placeholder="e.g. TRK-XXXXX" />
        <button className="btn btn-primary track-submit" type="submit" disabled={busy}>
          {busy ? 'Checking...' : 'Track now'} <ArrowRight size={16}/>
        </button>
        {message && <p className="form-feedback" role="status">{message}</p>}
        {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}
      </motion.form>

      {result && (
        <div className="tracking-result" style={{ marginTop: '1rem' }}>
          <div className="tracking-summary" style={{ display: 'grid', gap: '0.5rem', padding: '1rem', background: '#fff', borderRadius: '0.75rem', border: '1px solid rgba(11, 31, 63, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
              <strong style={{ fontSize: '1rem' }}>Shipment {result.shipmentNumber}</strong>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '999px', background: '#eafaf2', color: '#0a7a42', fontSize: '0.75rem', fontWeight: 700 }}>
                <CheckCircle2 size={14} /> {result.status}
              </span>
            </div>
            <div style={{ color: '#41506a', fontSize: '0.92rem' }}>
              {result.origin ? `${result.origin.city}, ${result.origin.countryCode}` : 'Origin unavailable'} → {result.destination ? `${result.destination.city}, ${result.destination.countryCode}` : 'Destination unavailable'}
            </div>
            <div style={{ color: '#41506a', fontSize: '0.9rem' }}>
              Mode: {result.mode} · Updated {new Date(result.updatedAt).toLocaleString()}
            </div>
            {result.estimatedDelivery && (
              <div style={{ color: '#41506a', fontSize: '0.9rem' }}>
                Estimated delivery: {new Date(result.estimatedDelivery).toLocaleString()}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            {result.recentEvents.map((event, index) => (
              <div key={`${event.occurredAt}-${index}`} style={{ padding: '0.85rem 1rem', background: '#f7f9fc', borderRadius: '0.75rem', border: '1px solid rgba(11, 31, 63, 0.08)' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{event.status}</div>
                <div style={{ color: '#41506a', fontSize: '0.88rem' }}>
                  {event.locationLabel || 'Location not recorded'} · {event.source}
                </div>
                {event.notes && <div style={{ color: '#41506a', fontSize: '0.88rem', marginTop: '0.2rem' }}>{event.notes}</div>}
                <div style={{ color: '#6a7a8c', fontSize: '0.8rem', marginTop: '0.25rem' }}>{new Date(event.occurredAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
