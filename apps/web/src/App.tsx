import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  Headphones,
  Globe2,
  MapPin,
  ChevronDown,
  CircleCheck,
  Mail,
  PackageCheck,
  PackageSearch,
  Route,
  Phone,
  MessageCircle,
  UserRound,
} from "lucide-react";
import Brand from "./components/Brand";
import TrackingForm from "./components/TrackingForm";
import { services } from "./data/services";
import CustomerAccess from "./components/CustomerAccess";
import ServiceInquiry from "./components/ServiceInquiry";
import ShipmentQuote from "./components/ShipmentQuote";
import AdminDashboard from "./AdminDashboard";

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE as string | undefined;
const supportWhatsApp = import.meta.env.VITE_SUPPORT_WHATSAPP as
  | string
  | undefined;
const phoneHref = supportPhone
  ? `tel:${supportPhone.replace(/[^+0-9]/g, "")}`
  : undefined;
const whatsappHref = supportWhatsApp
  ? `https://wa.me/${supportWhatsApp.replace(/\D/g, "")}`
  : undefined;

const nav = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Track shipment", href: "#tracking" },
  { label: "Destinations", href: "#destinations" },
  { label: "About", href: "#about" },
];

const benefits = [
  {
    icon: MapPin,
    title: "China-origin operations",
    text: "A shipping experience designed around cargo moving out of China.",
  },
  {
    icon: Globe2,
    title: "International destinations",
    text: "Air and sea freight options for eligible destinations worldwide.",
  },
  {
    icon: ShieldCheck,
    title: "Clear shipment milestones",
    text: "Understand the progress recorded for your shipment.",
  },
  {
    icon: Headphones,
    title: "Customer support",
    text: "A clear contact point for shipment and service enquiries.",
  },
];

function Header({
  onAccount,
  onQuote,
}: {
  onAccount: () => void;
  onQuote: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="topbar china-topbar">
        <div className="container topbar-inner">
          <span>
            <ShieldCheck size={13} /> China origin <i /> Worldwide shipping{" "}
            <i /> Customer support
          </span>
          <div>
            {phoneHref && (
              <a href={phoneHref}>
                <Phone size={13} /> Call support
              </a>
            )}
            <a href="mailto:info@truemanlogistics.com">
              <Mail size={13} /> info@truemanlogistics.com
            </a>
            <i />
            <span>
              <Globe2 size={13} /> English <ChevronDown size={12} />
            </span>
          </div>
        </div>
      </div>
      <header className="site-header china-header">
        <div className="container nav-inner">
          <Brand />
          <nav className={open ? "nav-open" : ""} aria-label="Main navigation">
            {nav.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={index === 0 ? "active" : ""}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a className="nav-admin" href="/admin" aria-label="Admin dashboard">
            Admin
          </a>
          <button
            className="btn btn-outline nav-account"
            onClick={onAccount}
            aria-label="Customer login"
          >
            <UserRound size={15} />
            <span>Customer login</span>
          </button>
          <button className="btn btn-primary nav-quote" onClick={onQuote}>
            Get a quote <ArrowRight size={15} />
          </button>
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}

function Hero({ onQuote }: { onQuote: () => void }) {
  const reduced = useReducedMotion() ?? false;
  return (
    <section className="china-hero" id="home">
      <div className="china-hero-image" aria-hidden="true" />
      <div className="china-hero-shade" aria-hidden="true" />
      <div className="container china-hero-inner">
        <motion.div
          className="china-hero-copy"
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <span className="china-eyebrow">
            <span /> INTERNATIONAL LOGISTICS · CHINA ORIGIN
          </span>
          <h1>
            <em>China</em> to the
            <br />
            World.
          </h1>
          <h2>Global Shipping. Reliable Delivery.</h2>
          <p>
            Your trusted partner for international air freight, sea freight and
            express shipping from China to destinations worldwide.
          </p>
          <div className="china-hero-actions">
            <button onClick={onQuote} className="btn btn-primary">
              Request a quote <ArrowRight size={16} />
            </button>
            <a href="#tracking" className="btn china-btn-glass">
              Track shipment <PackageSearch size={16} />
            </a>
          </div>
          <div className="china-hero-assurance">
            <span>
              <ShieldCheck size={15} /> Shipment visibility
            </span>
            <span>
              <Globe2 size={15} /> Global destinations
            </span>
          </div>
        </motion.div>
        <motion.div
          className="china-origin-chip"
          animate={reduced ? undefined : { y: [0, -7, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <span>
            <MapPin size={18} />
          </span>
          <div>
            <b>Shipping from China</b>
            <small>International destinations</small>
          </div>
        </motion.div>
      </div>
      <div className="container china-hero-bottom">
        <div className="china-hero-bottom-card">
          <div className="china-bottom-item">
            <span className="china-bottom-icon">
              <PackageCheck size={22} />
            </span>
            <div>
              <b>Request a shipment quote</b>
              <small>Start with your cargo details</small>
            </div>
            <button onClick={onQuote} aria-label="Request a quote">
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="china-bottom-item">
            <span className="china-bottom-icon china-bottom-icon-dark">
              <Route size={22} />
            </span>
            <div>
              <b>Track your shipment</b>
              <small>View recorded shipment progress</small>
            </div>
            <a href="#tracking" aria-label="Track shipment">
              <ArrowUpRight size={19} />
            </a>
          </div>
          <div className="china-bottom-support">
            <Headphones size={23} />
            <div>
              <b>Need assistance?</b>
              <a href={phoneHref ?? "mailto:info@truemanlogistics.com"}>
                {phoneHref ? "Call our team" : "Email our team"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  kicker,
  title,
  accent,
  description,
}: {
  kicker: string;
  title: string;
  accent?: string;
  description: string;
}) {
  return (
    <div className="china-section-heading">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h2>
          {title} {accent && <em>{accent}</em>}
        </h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function Services({ onInquiry }: { onInquiry: (service: string) => void }) {
  return (
    <section className="china-section china-services" id="services">
      <div className="container">
        <SectionHeading
          kicker="SHIPPING SERVICES"
          title="The right route for"
          accent="every shipment."
          description="Choose the option that fits your cargo, urgency and destination. Final route availability and service conditions are confirmed when your shipment is quoted."
        />
        <motion.div
          className="china-service-grid"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.article
                className="china-service-card"
                key={service.title}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
                }}
              >
                <div className="china-service-card-top">
                  <span>
                    <Icon size={24} />
                  </span>
                  <small>0{index + 1}</small>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <p className="china-service-detail">{service.detail}</p>
                <button
                  className="service-inquiry-button"
                  onClick={() => onInquiry(service.title)}
                >
                  Talk to a shipping specialist <ArrowUpRight size={16} />
                </button>
                <div className="service-contact-actions">
                  {phoneHref && (
                    <a href={phoneHref}>
                      <Phone size={13} /> Call
                    </a>
                  )}
                  {whatsappHref && (
                    <a
                      href={`${whatsappHref}?text=${encodeURIComponent(`Hello, I have a question about ${service.title}.`)}`}
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function TrackingSection() {
  return (
    <section className="china-tracking-section" id="tracking">
      <div className="container china-tracking-layout">
        <div className="china-tracking-copy">
          <span className="section-kicker">SHIPMENT VISIBILITY</span>
          <h2>
            Know where your
            <br />
            <em>shipment stands.</em>
          </h2>
          <p>
            Enter the tracking reference issued for your shipment to check its
            latest recorded progress.
          </p>
          <div className="china-tracking-points">
            <span>
              <CircleCheck size={16} /> Shipment milestone history
            </span>
            <span>
              <CircleCheck size={16} /> Recorded location and status updates
            </span>
            <span>
              <CircleCheck size={16} /> Clear distinction between scans and live
              GPS
            </span>
          </div>
        </div>
        <div className="china-tracking-card">
          <div className="china-tracking-card-head">
            <span>
              <PackageSearch size={23} />
            </span>
            <div>
              <b>Track your shipment</b>
              <small>From China to its destination</small>
            </div>
            <span className="china-track-label">
              <i /> TRACKING
            </span>
          </div>
          <TrackingForm compact />
          <div className="china-tracking-note">
            <ShieldCheck size={15} /> A tracking reference does not authorize
            shipment changes or reveal protected personal details.
          </div>
        </div>
      </div>
    </section>
  );
}

type GeoPoint = readonly [longitude: number, latitude: number];

const worldLand: readonly (readonly GeoPoint[])[] = [
  [
    [-168, 70],
    [-160, 71],
    [-151, 68],
    [-144, 69],
    [-137, 65],
    [-132, 58],
    [-128, 54],
    [-125, 49],
    [-123, 44],
    [-118, 34],
    [-112, 31],
    [-106, 29],
    [-100, 28],
    [-97, 25],
    [-92, 19],
    [-88, 17],
    [-84, 19],
    [-81, 24],
    [-80, 29],
    [-77, 34],
    [-74, 40],
    [-69, 44],
    [-64, 46],
    [-59, 51],
    [-63, 56],
    [-69, 59],
    [-73, 63],
    [-79, 67],
    [-85, 70],
    [-92, 73],
    [-101, 72],
    [-110, 74],
    [-119, 73],
    [-130, 72],
    [-140, 70],
    [-151, 72],
    [-160, 70],
    [-168, 70],
  ],
  [
    [-168, 65],
    [-164, 61],
    [-158, 58],
    [-153, 59],
    [-150, 62],
    [-154, 66],
    [-161, 68],
    [-168, 65],
  ],
  [
    [-53, 83],
    [-45, 81],
    [-39, 76],
    [-36, 71],
    [-41, 66],
    [-46, 61],
    [-52, 59],
    [-59, 63],
    [-62, 69],
    [-59, 76],
    [-53, 83],
  ],
  [
    [-10, 36],
    [-9, 43],
    [-5, 48],
    [0, 50],
    [3, 54],
    [9, 55],
    [14, 58],
    [20, 60],
    [25, 65],
    [28, 70],
    [31, 72],
    [29, 75],
    [34, 77],
    [40, 73],
    [45, 69],
    [51, 69],
    [60, 68],
    [70, 70],
    [80, 73],
    [95, 75],
    [110, 74],
    [125, 72],
    [139, 70],
    [151, 68],
    [163, 65],
    [170, 61],
    [164, 57],
    [157, 55],
    [151, 51],
    [145, 49],
    [141, 45],
    [137, 43],
    [132, 42],
    [128, 38],
    [126, 34],
    [122, 31],
    [120, 26],
    [116, 23],
    [112, 21],
    [110, 18],
    [107, 16],
    [104, 13],
    [101, 10],
    [98, 7],
    [95, 8],
    [92, 12],
    [90, 21],
    [86, 22],
    [83, 20],
    [80, 9],
    [77, 8],
    [74, 13],
    [72, 20],
    [68, 23],
    [63, 25],
    [58, 25],
    [53, 27],
    [49, 30],
    [46, 33],
    [43, 37],
    [39, 40],
    [34, 41],
    [30, 42],
    [27, 45],
    [24, 43],
    [22, 40],
    [19, 41],
    [17, 45],
    [16, 49],
    [14, 53],
    [11, 56],
    [8, 58],
    [7, 55],
    [4, 53],
    [2, 51],
    [-3, 51],
    [-5, 48],
    [-7, 45],
    [-10, 43],
    [-10, 36],
  ],
  [
    [-17, 14],
    [-16, 21],
    [-13, 27],
    [-9, 32],
    [-5, 36],
    [1, 36],
    [8, 37],
    [13, 33],
    [20, 32],
    [25, 31],
    [32, 31],
    [35, 28],
    [41, 15],
    [50, 11],
    [49, 3],
    [45, -5],
    [42, -12],
    [40, -18],
    [35, -24],
    [33, -30],
    [27, -34],
    [20, -34],
    [17, -29],
    [14, -23],
    [12, -16],
    [10, -5],
    [6, 5],
    [1, 5],
    [-5, 5],
    [-10, 8],
    [-15, 11],
    [-17, 14],
  ],
  [
    [-81, 12],
    [-77, 8],
    [-75, 4],
    [-77, 0],
    [-79, -5],
    [-76, -10],
    [-73, -16],
    [-70, -22],
    [-68, -28],
    [-64, -34],
    [-60, -39],
    [-55, -45],
    [-51, -51],
    [-47, -54],
    [-43, -50],
    [-40, -43],
    [-38, -35],
    [-35, -27],
    [-35, -19],
    [-39, -12],
    [-42, -6],
    [-47, -2],
    [-50, 1],
    [-56, 4],
    [-62, 7],
    [-68, 10],
    [-74, 11],
    [-81, 12],
  ],
  [
    [113, -11],
    [115, -20],
    [121, -18],
    [127, -16],
    [133, -12],
    [137, -14],
    [141, -17],
    [147, -19],
    [153, -25],
    [151, -33],
    [146, -38],
    [139, -37],
    [134, -34],
    [128, -34],
    [123, -32],
    [118, -29],
    [115, -22],
    [113, -11],
  ],
  [
    [44, -12],
    [49, -13],
    [50, -18],
    [48, -24],
    [45, -25],
    [43, -20],
    [44, -12],
  ],
  [
    [130, 33],
    [132, 34],
    [135, 35],
    [137, 37],
    [140, 41],
    [142, 44],
    [145, 43],
    [143, 39],
    [141, 36],
    [138, 35],
    [135, 34],
    [133, 32],
    [130, 33],
  ],
  [
    [95, 5],
    [101, 3],
    [107, 1],
    [112, -1],
    [117, -2],
    [122, -4],
    [128, -4],
    [133, -3],
    [130, -7],
    [124, -8],
    [118, -7],
    [112, -6],
    [107, -5],
    [102, -4],
    [98, -2],
    [95, 5],
  ],
];

function projectMapPoint([longitude, latitude]: GeoPoint) {
  return {
    x: ((longitude + 180) * 640) / 360,
    y: 8 + ((90 - latitude) * 334) / 180,
  };
}

const worldLandPath = worldLand
  .map(
    (polygon) =>
      polygon
        .map(([longitude, latitude], index) => {
          const { x, y } = projectMapPoint([longitude, latitude]);
          return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
  )
  .join(" ");

const routeOrigin = projectMapPoint([105, 35]);
const destinationRoutes = [
  { name: "Europe", point: [-2, 50] as const, curve: -56 },
  { name: "Gulf region", point: [52, 25] as const, curve: -34 },
  { name: "Southeast Asia", point: [104, 1] as const, curve: -42 },
  { name: "Australia", point: [151, -34] as const, curve: -42 },
  { name: "North America", point: [-118, 34] as const, curve: -66 },
].map((destination) => {
  const end = projectMapPoint(destination.point);
  const controlX = (routeOrigin.x + end.x) / 2;
  const controlY = Math.min(routeOrigin.y, end.y) + destination.curve;

  return {
    ...destination,
    end,
    control: { x: controlX, y: controlY },
    path: `M${routeOrigin.x.toFixed(1)} ${routeOrigin.y.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
  };
});
const flightPath = `M${routeOrigin.x.toFixed(1)} ${routeOrigin.y.toFixed(1)} ${destinationRoutes
  .map(
    (route) =>
      `Q${route.control.x.toFixed(1)} ${route.control.y.toFixed(1)} ${route.end.x.toFixed(1)} ${route.end.y.toFixed(1)} Q${route.control.x.toFixed(1)} ${route.control.y.toFixed(1)} ${routeOrigin.x.toFixed(1)} ${routeOrigin.y.toFixed(1)}`,
  )
  .join(" ")}`;

function Destinations() {
  const reduced = useReducedMotion() ?? false;
  return (
    <section className="china-destinations" id="destinations">
      <div className="container china-destinations-layout">
        <div className="china-destinations-copy">
          <span className="section-kicker">CHINA ORIGIN · GLOBAL REACH</span>
          <h2>
            One origin.
            <br />
            <em>Worldwide possibilities.</em>
          </h2>
          <p>
            Trueman Logistics is built around international shipments
            originating in China. Tell us where your cargo needs to go and we'll
            help identify the available shipping options.
          </p>
          <a
            href="mailto:info@truemanlogistics.com?subject=Destination%20availability%20enquiry"
            className="btn btn-primary"
          >
            Ask about your destination <ArrowRight size={16} />
          </a>
          <small>
            Destination coverage, customs requirements and service availability
            are confirmed per route.
          </small>
        </div>
        <div
          className="china-route-visual"
          role="img"
          aria-label="Map showing illustrative air freight routes from China to Europe, the Gulf region, Southeast Asia, Australia, and North America."
        >
          <div className="china-route-grid" />
          <svg viewBox="0 0 640 350" aria-hidden="true" focusable="false">
            <path className="china-map-land" d={worldLandPath} />
            {destinationRoutes.map((route, index) => (
              <path
                key={route.name}
                className={`china-route-line${index === 0 ? " china-route-line-active" : ""}`}
                d={route.path}
              />
            ))}
            {!reduced && (
              <g className="china-route-plane">
                <animateMotion
                  dur="45s"
                  repeatCount="indefinite"
                  rotate="auto"
                  path={flightPath}
                />
                <path d="M0 -10 2 -3 9 1 9 3 3 2 -1 9 -3 9 -2 2 -9 4 -9 1 -2 -3Z" />
              </g>
            )}
            {destinationRoutes.map((route, index) => (
              <circle
                key={route.name}
                className="china-route-point"
                cx={route.end.x}
                cy={route.end.y}
                r={index === 0 ? 4.5 : 3.5}
              />
            ))}
            <g
              className={`china-route-origin${reduced ? " is-static" : ""}`}
              transform={`translate(${routeOrigin.x.toFixed(1)} ${routeOrigin.y.toFixed(1)})`}
            >
              <circle className="china-route-origin-halo" r="13" />
              <g className="china-route-origin-pin">
                <path d="M0 0C-2.5-4-10-11-10-17a10 10 0 1 1 20 0C10-11 2.5-4 0 0Z" />
                <circle cx="0" cy="-17" r="3" />
              </g>
              <text className="china-route-origin-label" x="14" y="-14">
                CHINA
              </text>
              <text className="china-route-origin-subtitle" x="14" y="-3">
                ORIGIN
              </text>
            </g>
          </svg>
          <div className="china-route-caption">
            <Globe2 size={20} />
            <span>
              <b>International freight</b>
              <small>
                Illustrative routes · Confirm destination availability
              </small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function About({ onInquiry }: { onInquiry: (service: string) => void }) {
  return (
    <section className="china-section china-about" id="about">
      <div className="container china-about-layout">
        <div className="china-about-copy">
          <span className="section-kicker">ABOUT TRUEMAN LOGISTICS</span>
          <h2>
            Connecting China
            <br />
            to the <em>world.</em>
          </h2>
          <p>
            Trueman Logistics is a China-based logistics business focused on
            helping individuals and companies move cargo from China to
            international destinations. We bring together shipping options,
            shipment coordination and clear communication throughout the
            journey.
          </p>
          <p>
            Our goal is simple: make international shipping easier to
            understand, easier to arrange and easier to follow.
          </p>
          <button
            onClick={() => onInquiry("General customer service inquiry")}
            className="china-text-link about-inquiry-button"
          >
            Speak with our team <ArrowRight size={16} />
          </button>
        </div>
        <div className="china-about-grid">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article className="china-about-item" key={benefit.title}>
                <span>
                  <Icon size={22} />
                </span>
                <div>
                  <b>{benefit.title}</b>
                  <p>{benefit.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer({ onInquiry }: { onInquiry: (service: string) => void }) {
  return (
    <footer className="china-footer">
      <div className="container">
        <div className="china-footer-main">
          <div className="china-footer-brand">
            <Brand light />
            <p>
              Global shipping. Reliable delivery.
              <br />
              From China to the world.
            </p>
          </div>
          <div className="china-footer-links">
            <b>Explore</b>
            <a href="#services">Shipping services</a>
            <a href="#tracking">Track shipment</a>
            <a href="#destinations">Destinations</a>
          </div>
          <div className="china-footer-contact">
            <b>Contact</b>
            {phoneHref && (
              <a href={phoneHref}>
                <Phone size={15} /> Call customer service
              </a>
            )}
            {whatsappHref && (
              <a href={whatsappHref}>
                <MessageCircle size={15} /> WhatsApp customer service
              </a>
            )}
            <a href="mailto:info@truemanlogistics.com">
              <Mail size={15} /> info@truemanlogistics.com
            </a>
            <span>
              <MapPin size={15} /> China · International shipping
            </span>
          </div>
          <div className="china-footer-cta">
            <span>READY TO SHIP?</span>
            <h3>
              Let's move your
              <br />
              world together.
            </h3>
            <button
              onClick={() => onInquiry("General shipping enquiry")}
              className="btn btn-white"
            >
              Contact Trueman <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className="china-footer-bottom">
          <span>
            © {new Date().getFullYear()} Trueman Logistics. All rights reserved.
          </span>
          <span>China origin · Worldwide destinations</span>
          <a href="/admin">Staff portal</a>
          <a href="#home">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [inquiryService, setInquiryService] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;

    const lenis = new Lenis({
      anchors: true,
      autoRaf: true,
      lerp: 0.075,
      respectReducedMotion: true,
    });

    return () => lenis.destroy();
  }, []);

  if (window.location.pathname.startsWith("/admin")) return <AdminDashboard />;
  return (
    <>
      <Header
        onAccount={() => setAccountOpen(true)}
        onQuote={() => setQuoteOpen(true)}
      />
      <main>
        <Hero onQuote={() => setQuoteOpen(true)} />
        <Services onInquiry={setInquiryService} />
        <TrackingSection />
        <Destinations />
        <About onInquiry={setInquiryService} />
      </main>
      <Footer onInquiry={setInquiryService} />
      {accountOpen && <CustomerAccess onClose={() => setAccountOpen(false)} />}
      {inquiryService && (
        <ServiceInquiry
          service={inquiryService}
          onClose={() => setInquiryService(null)}
        />
      )}
      {quoteOpen && (
        <ShipmentQuote
          onClose={() => setQuoteOpen(false)}
          onLogin={() => setAccountOpen(true)}
        />
      )}
      <div className="support-fab" aria-label="Customer support">
        {phoneHref && (
          <a href={phoneHref} aria-label="Call customer service">
            <Phone size={19} />
          </a>
        )}
        {whatsappHref && (
          <a
            href={`${whatsappHref}?text=${encodeURIComponent("Hello Trueman Logistics, I need help with international shipping from China.")}`}
            aria-label="WhatsApp customer service"
          >
            <MessageCircle size={19} />
          </a>
        )}
        <button
          onClick={() => setInquiryService("General customer service inquiry")}
          aria-label="Contact customer service"
        >
          <Headphones size={19} />
        </button>
      </div>
    </>
  );
}
