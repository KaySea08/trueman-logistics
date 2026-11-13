import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Lenis from 'lenis';
import {
  ArrowRight, ArrowUpRight, Menu, X, ShieldCheck, Headphones, Globe2,
  MapPin, ChevronDown, CircleCheck, Mail, PackageCheck,
  PackageSearch, Route, Phone, MessageCircle, UserRound,
} from 'lucide-react';
import Brand from './components/Brand';
import TrackingForm from './components/TrackingForm';
import { services } from './data/services';
import CustomerAccess from './components/CustomerAccess';
import ServiceInquiry from './components/ServiceInquiry';
import ShipmentQuote from './components/ShipmentQuote';
import AdminDashboard from './AdminDashboard';

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;
const supportWhatsApp = import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined;
const phoneHref = supportPhone ? `tel:${supportPhone.replace(/[^+0-9]/g, '')}` : undefined;
const whatsappHref = supportWhatsApp ? `https://wa.me/${supportWhatsApp.replace(/\D/g, '')}` : undefined;

const nav = [
  { label: 'Home', href: '#home' },
  { label: 'Services', href: '#services' },
  { label: 'Track shipment', href: '#tracking' },
  { label: 'Destinations', href: '#destinations' },
  { label: 'About', href: '#about' },
];

const benefits = [
  { icon: MapPin, title: 'China-origin operations', text: 'A shipping experience designed around cargo moving out of China.' },
  { icon: Globe2, title: 'International destinations', text: 'Air and sea freight options for eligible destinations worldwide.' },
  { icon: ShieldCheck, title: 'Clear shipment milestones', text: 'Understand the progress recorded for your shipment.' },
  { icon: Headphones, title: 'Customer support', text: 'A clear contact point for shipment and service enquiries.' },
];

function Header({ onAccount, onQuote }: { onAccount: () => void; onQuote: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <div className="topbar china-topbar">
      <div className="container topbar-inner">
        <span><ShieldCheck size={13}/> China origin <i/> Worldwide shipping <i/> Customer support</span>
        <div>{phoneHref && <a href={phoneHref}><Phone size={13}/> Call support</a>}<a href="mailto:info@truemanlogistics.com"><Mail size={13}/> info@truemanlogistics.com</a><i/><span><Globe2 size={13}/> English <ChevronDown size={12}/></span></div>
      </div>
    </div>
    <header className="site-header china-header">
      <div className="container nav-inner">
        <Brand />
        <nav className={open ? 'nav-open' : ''} aria-label="Main navigation">
          {nav.map((item, index) => <a key={item.href} href={item.href} onClick={() => setOpen(false)} className={index === 0 ? 'active' : ''}>{item.label}</a>)}
        </nav>
        <a className="nav-admin" href="/admin" aria-label="Admin dashboard">Admin</a>
        <button className="btn btn-outline nav-account" onClick={onAccount}><UserRound size={15}/> Customer login</button>
        <button className="btn btn-primary nav-quote" onClick={onQuote}>Get a quote <ArrowRight size={15}/></button>
        <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'}>{open ? <X/> : <Menu/>}</button>
      </div>
    </header>
  </>;
}

function Hero({ onQuote }: { onQuote: () => void }) {
  const reduced = useReducedMotion() ?? false;
  return <section className="china-hero" id="home">
    <div className="china-hero-image" aria-hidden="true" />
    <div className="china-hero-shade" aria-hidden="true" />
    <div className="container china-hero-inner">
      <motion.div className="china-hero-copy" initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>
        <span className="china-eyebrow"><span/> INTERNATIONAL LOGISTICS · CHINA ORIGIN</span>
        <h1><em>China</em> to the<br/>World.</h1>
        <h2>Global Shipping. Reliable Delivery.</h2>
        <p>Your trusted partner for international air freight, sea freight and express shipping from China to destinations worldwide.</p>
        <div className="china-hero-actions">
          <button onClick={onQuote} className="btn btn-primary">Start shipping <ArrowRight size={16}/></button>
          <a href="#tracking" className="btn china-btn-glass">Track shipment <PackageSearch size={16}/></a>
        </div>
        <div className="china-hero-assurance"><span><ShieldCheck size={15}/> Shipment visibility</span><span><Globe2 size={15}/> Global destinations</span></div>
      </motion.div>
      <motion.div className="china-origin-chip" animate={reduced ? undefined : { y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <span><MapPin size={18}/></span><div><b>Shipping from China</b><small>International destinations</small></div>
      </motion.div>
    </div>
    <div className="container china-hero-bottom">
      <div className="china-hero-bottom-card">
        <div className="china-bottom-item"><span className="china-bottom-icon"><PackageCheck size={22}/></span><div><b>Request a shipment quote</b><small>Start with your cargo details</small></div><button onClick={onQuote} aria-label="Request a quote"><ArrowUpRight size={19}/></button></div>
        <div className="china-bottom-item"><span className="china-bottom-icon china-bottom-icon-dark"><Route size={22}/></span><div><b>Track your shipment</b><small>View recorded shipment progress</small></div><a href="#tracking" aria-label="Track shipment"><ArrowUpRight size={19}/></a></div>
        <div className="china-bottom-support"><Headphones size={23}/><div><b>Need assistance?</b><a href={phoneHref ?? 'mailto:info@truemanlogistics.com'}>{phoneHref ? 'Call our team' : 'Email our team'}</a></div></div>
      </div>
    </div>
  </section>;
}

function SectionHeading({ kicker, title, accent, description }: { kicker: string; title: string; accent?: string; description: string }) {
  return <div className="china-section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title} {accent && <em>{accent}</em>}</h2></div><p>{description}</p></div>;
}

function Services({ onInquiry }: { onInquiry: (service: string) => void }) {
  return <section className="china-section china-services" id="services">
    <div className="container">
      <SectionHeading kicker="SHIPPING SERVICES" title="The right route for" accent="every shipment." description="Choose a shipping option that fits your cargo, timeline and destination. Service availability and transit estimates are confirmed when your shipment is quoted." />
      <motion.div className="china-service-grid" initial="hidden" whileInView="show" viewport={{ once: true, amount: .12 }} variants={{ hidden: {}, show: { transition: { staggerChildren: .08 } } }}>
        {services.map((service, index) => { const Icon = service.icon; return <motion.article className="china-service-card" key={service.title} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: .45 } } }}>
          <div className="china-service-card-top"><span><Icon size={24}/></span><small>0{index + 1}</small></div>
          <h3>{service.title}</h3><p>{service.description}</p>
          <button className="service-inquiry-button" onClick={() => onInquiry(service.title)}>Talk to a shipping specialist <ArrowUpRight size={16}/></button><div className="service-contact-actions">{phoneHref && <a href={phoneHref}><Phone size={13}/> Call</a>}{whatsappHref && <a href={`${whatsappHref}?text=${encodeURIComponent(`Hello, I have a question about ${service.title}.`)}`}><MessageCircle size={13}/> WhatsApp</a>}</div>
        </motion.article>; })}
      </motion.div>
    </div>
  </section>;
}

function TrackingSection() {
  return <section className="china-tracking-section" id="tracking">
    <div className="container china-tracking-layout">
      <div className="china-tracking-copy"><span className="section-kicker">SHIPMENT VISIBILITY</span><h2>Know where your<br/><em>shipment stands.</em></h2><p>Enter the tracking reference issued for your shipment to check its latest recorded progress.</p>
        <div className="china-tracking-points"><span><CircleCheck size={16}/> Shipment milestone history</span><span><CircleCheck size={16}/> Recorded location and status updates</span><span><CircleCheck size={16}/> Clear distinction between scans and live GPS</span></div>
      </div>
      <div className="china-tracking-card"><div className="china-tracking-card-head"><span><PackageSearch size={23}/></span><div><b>Track your shipment</b><small>From China to its destination</small></div><span className="china-track-label"><i/> TRACKING</span></div><TrackingForm compact/><div className="china-tracking-note"><ShieldCheck size={15}/> A tracking reference does not authorize shipment changes or reveal protected personal details.</div></div>
    </div>
  </section>;
}

function Destinations() {
  const reduced = useReducedMotion() ?? false;
  return <section className="china-destinations" id="destinations"><div className="container china-destinations-layout">
    <div className="china-destinations-copy"><span className="section-kicker">CHINA ORIGIN · GLOBAL REACH</span><h2>One origin.<br/><em>Worldwide possibilities.</em></h2><p>Trueman Logistics is built around international shipments originating in China. Tell us where your cargo needs to go and we'll help identify the available shipping options.</p><a href="mailto:info@truemanlogistics.com?subject=Destination%20availability%20enquiry" className="btn btn-primary">Ask about your destination <ArrowRight size={16}/></a><small>Destination coverage, customs requirements and service availability are confirmed per route.</small></div>
    <div className="china-route-visual" aria-label="Illustrative global shipping routes originating in China">
      <div className="china-route-grid"/><svg viewBox="0 0 640 350" role="img" aria-label="Illustrative route lines from China to international regions"><path className="china-map-land" d="M45 92l34-28 40 7 20 23 36-7 22 22-17 25-37 7-18 32-31-8-13-31-34-9zm102 116 31-13 25 18-6 32-24 18-22-21zm128-128 38-24 43 10 31-13 45 20 48-2 37 26-14 29-39 4-25 29-34-9-20 24-31-15-25 10-19-25-33-7-19-26zm135 123 34-15 31 12 16 30-25 25-38-8-23-23z"/><path className="china-route-line" d="M480 135 Q350 10 180 105 T80 245 M480 135 Q400 205 330 240 T230 280 M480 135 Q545 120 585 210"/><path className="china-route-line china-route-line-alt" d="M480 135 Q520 45 590 70"/></svg>
      <motion.div className="china-route-origin" animate={reduced ? undefined : { y: [0, -5, 0] }} transition={{ duration: 3.5, repeat: Infinity }}><MapPin size={22} fill="currentColor"/><b>CHINA</b></motion.div>
      <span className="china-route-point route-point-one"/><span className="china-route-point route-point-two"/><span className="china-route-point route-point-three"/><span className="china-route-point route-point-four"/>
      <div className="china-route-caption"><Globe2 size={20}/><span><b>International freight</b><small>Illustrative routes · Confirm destination availability</small></span></div>
    </div>
  </div></section>;
}

function About({ onInquiry }: { onInquiry: (service: string) => void }) {
  return <section className="china-section china-about" id="about"><div className="container china-about-layout">
    <div className="china-about-copy"><span className="section-kicker">ABOUT TRUEMAN LOGISTICS</span><h2>Connecting China<br/>to the <em>world.</em></h2><p>Trueman Logistics is a China-based logistics business focused on helping individuals and companies move cargo from China to international destinations. We bring together shipping options, shipment coordination and clear communication throughout the journey.</p><p>Our goal is simple: make international shipping easier to understand, easier to arrange and easier to follow.</p><button onClick={() => onInquiry('General customer service inquiry')} className="china-text-link about-inquiry-button">Speak with our team <ArrowRight size={16}/></button></div>
    <div className="china-about-grid">{benefits.map((benefit) => { const Icon = benefit.icon; return <article className="china-about-item" key={benefit.title}><span><Icon size={22}/></span><div><b>{benefit.title}</b><p>{benefit.text}</p></div></article>; })}</div>
  </div></section>;
}

function Footer({ onInquiry }: { onInquiry: (service: string) => void }) {
  return <footer className="china-footer"><div className="container"><div className="china-footer-main"><div className="china-footer-brand"><Brand light/><p>Global shipping. Reliable delivery.<br/>From China to the world.</p></div><div className="china-footer-links"><b>Explore</b><a href="#services">Shipping services</a><a href="#tracking">Track shipment</a><a href="#destinations">Destinations</a></div><div className="china-footer-contact"><b>Contact</b>{phoneHref && <a href={phoneHref}><Phone size={15}/> Call customer service</a>}{whatsappHref && <a href={whatsappHref}><MessageCircle size={15}/> WhatsApp customer service</a>}<a href="mailto:info@truemanlogistics.com"><Mail size={15}/> info@truemanlogistics.com</a><span><MapPin size={15}/> China · International shipping</span></div><div className="china-footer-cta"><span>READY TO SHIP?</span><h3>Let's move your<br/>world together.</h3><button onClick={() => onInquiry('General shipping enquiry')} className="btn btn-white">Contact Trueman <ArrowRight size={15}/></button></div></div><div className="china-footer-bottom"><span>© {new Date().getFullYear()} Trueman Logistics. All rights reserved.</span><span>China origin · Worldwide destinations</span><a href="/admin">Staff portal</a><a href="#home">Back to top ↑</a></div></div></footer>;
}

export default function App() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [inquiryService, setInquiryService] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;

    const lenis = new Lenis({
      anchors: true,
      autoRaf: true,
      lerp: 0.075,
      respectReducedMotion: true,
    });

    return () => lenis.destroy();
  }, []);

  if (window.location.pathname.startsWith('/admin')) return <AdminDashboard />;
  return <><Header onAccount={() => setAccountOpen(true)} onQuote={() => setQuoteOpen(true)}/><main><Hero onQuote={() => setQuoteOpen(true)}/><Services onInquiry={setInquiryService}/><TrackingSection/><Destinations/><About onInquiry={setInquiryService}/></main><Footer onInquiry={setInquiryService}/>{accountOpen && <CustomerAccess onClose={() => setAccountOpen(false)}/>}{inquiryService && <ServiceInquiry service={inquiryService} onClose={() => setInquiryService(null)}/>}{quoteOpen && <ShipmentQuote onClose={() => setQuoteOpen(false)} onLogin={() => setAccountOpen(true)}/>}<div className="support-fab" aria-label="Customer support">{phoneHref && <a href={phoneHref} aria-label="Call customer service"><Phone size={19}/></a>}{whatsappHref && <a href={`${whatsappHref}?text=${encodeURIComponent('Hello Trueman Logistics, I need help with international shipping from China.')}`} aria-label="WhatsApp customer service"><MessageCircle size={19}/></a>}<button onClick={() => setInquiryService('General customer service inquiry')} aria-label="Contact customer service"><Headphones size={19}/></button></div></>;
}
