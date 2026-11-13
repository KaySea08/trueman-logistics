import { useState } from 'react';
import { PackageOpen } from 'lucide-react';

/** Place approved artwork at public/images/trueman-logo.svg and trueman-logo-white.svg. */
export default function Brand({ light = false, href = '#home' }: { light?: boolean; href?: string }) {
  const [imageAvailable, setImageAvailable] = useState(true);
  const logoPath = light ? '/images/trueman-logo-white.svg' : '/images/trueman-logo.svg';
  return <a className={`brand ${light ? 'brand-light' : ''}`} href={href} aria-label="Trueman Logistics home">
    {imageAvailable ? <img className="brand-image" src={logoPath} alt="Trueman Logistics" onError={() => setImageAvailable(false)} /> : <><span className="brand-mark"><PackageOpen size={27} strokeWidth={2.2} /></span><span className="brand-words"><strong>TRUEMAN</strong><small>LOGISTICS</small></span></>}
  </a>;
}
