import { useState } from 'react';
import { ArrowRight, PackageSearch } from 'lucide-react';
import { motion } from 'framer-motion';
export default function TrackingForm({ compact = false }: { compact?: boolean }) {
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  function submit(e: React.FormEvent) { e.preventDefault(); setMessage(reference.trim() ? 'Tracking lookup is not connected yet. Shipment tracking will be enabled when the tracking service is implemented.' : 'Enter your tracking reference to continue.'); }
  return <motion.form initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`tracking-form ${compact ? 'tracking-compact' : ''}`} onSubmit={submit}>
    <div className="tracking-icon"><PackageSearch size={23}/></div>
    <div className="tracking-copy"><strong>Track your shipment</strong><span>Enter the reference issued for your shipment</span></div>
    <label className="sr-only" htmlFor={compact ? 'tracking-compact' : 'tracking-main'}>Tracking reference</label>
    <input id={compact ? 'tracking-compact' : 'tracking-main'} value={reference} onChange={e => { setReference(e.target.value); setMessage(''); }} placeholder="e.g. TRM-8F2K-2026" />
    <button className="btn btn-primary track-submit" type="submit">Track now <ArrowRight size={16}/></button>
    {message && <p className="form-feedback" role="status">{message}</p>}
  </motion.form>;
}
