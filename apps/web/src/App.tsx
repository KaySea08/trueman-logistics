import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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
  Plane,
  Route,
  Phone,
  MessageCircle,
  UserRound,
} from "lucide-react";
import Brand from "./components/Brand";
import TrackingForm from "./components/TrackingForm";
import { services } from "./data/services";
import LoginDialog from "./components/CustomerAccess";
import ServiceInquiry from "./components/ServiceInquiry";
import ShipmentQuote from "./components/ShipmentQuote";
import { useAuth } from "./auth/AuthContext";

const CustomerDashboard = lazy(() => import("./components/CustomerDashboard"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));

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

function RouteLoading() {
  return (
    <main className="customer-dashboard-gate" role="status" aria-live="polite">
      <div className="customer-dashboard-gate-content">
        <span className="customer-dashboard-spinner" aria-hidden="true" />
        <p>Loading secure workspace...</p>
      </div>
    </main>
  );
}

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
  accountHref,
  onQuote,
}: {
  accountHref: string;
  onQuote: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        let current = nav[0].href.slice(1);

        for (const item of nav) {
          const section = document.getElementById(item.href.slice(1));
          if (section && section.getBoundingClientRect().top <= 150) {
            current = item.href.slice(1);
          }
        }

        setActiveSection((previous) =>
          previous === current ? previous : current,
        );
      });
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

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
          <nav
            id="primary-navigation"
            className={open ? "nav-open" : ""}
            aria-label="Main navigation"
          >
            {nav.map((item) => {
              const sectionId = item.href.slice(1);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={activeSection === sectionId ? "active" : ""}
                  aria-current={
                    activeSection === sectionId ? "location" : undefined
                  }
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <a
            className="nav-admin"
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Admin dashboard"
          >
            Admin
          </a>
          <a
            className="btn btn-outline nav-account"
            href={accountHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Customer login"
          >
            <UserRound size={15} />
            <span>Customer login</span>
          </a>
          <button className="btn btn-primary nav-quote" onClick={onQuote}>
            Get a quote <ArrowRight size={15} />
          </button>
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="primary-navigation"
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

function projectMapPoint([longitude, latitude]: GeoPoint) {
  return {
    x: ((longitude + 180) * 640) / 360,
    y: 8 + ((90 - latitude) * 334) / 180,
  };
}

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
          <img
            className="china-route-map"
            src="/world-map.svg"
            alt=""
            aria-hidden="true"
            loading="lazy"
          />
          <svg viewBox="0 0 640 350" aria-hidden="true" focusable="false">
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
            <span>
              <span className="china-route-caption-title">
                <Plane size={16} aria-hidden="true" />
                <b>International freight</b>
              </span>
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
          <a href="/admin" target="_blank" rel="noopener noreferrer">
            Staff portal
          </a>
          <a href="#home">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, setReturnTo } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [dashboardLoginDismissed, setDashboardLoginDismissed] = useState(false);
  const [inquiryService, setInquiryService] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const openQuote = useCallback(() => setQuoteOpen(true), []);

  function openLogin(returnTo = "/dashboard") {
    setReturnTo(returnTo);
    setDashboardLoginDismissed(false);
    setAccountOpen(true);
  }

  function closeLogin() {
    setAccountOpen(false);
    if (location.pathname === "/dashboard" && !user) {
      setDashboardLoginDismissed(true);
    }
  }

  function requestQuote() {
    if (user) openQuote();
    else openLogin("/dashboard?intent=quote");
  }

  useEffect(() => {
    if (
      location.pathname !== "/dashboard" ||
      loading ||
      user ||
      accountOpen ||
      dashboardLoginDismissed
    )
      return;
    setReturnTo(`${location.pathname}${location.search}`);
    setAccountOpen(true);
  }, [
    accountOpen,
    dashboardLoginDismissed,
    loading,
    location.pathname,
    location.search,
    setReturnTo,
    user,
  ]);

  useEffect(() => {
    if (location.pathname !== "/customer/login" || loading || accountOpen)
      return;
    if (user?.roles.includes("CUSTOMER")) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setReturnTo("/dashboard");
    setAccountOpen(true);
  }, [accountOpen, loading, location.pathname, navigate, setReturnTo, user]);

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

  if (location.pathname.startsWith("/admin")) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  if (location.pathname === "/dashboard") {
    if (loading) {
      return (
        <main className="customer-dashboard-gate" aria-live="polite">
          <div className="customer-dashboard-gate-content">
            <span className="customer-dashboard-spinner" />
            <p>Checking your secure session…</p>
          </div>
        </main>
      );
    }
    if (!user) {
      return (
        <main className="customer-dashboard-gate">
          <div className="customer-dashboard-gate-content">
            <h1>Sign in to your account</h1>
            <p>Your shipments and quotations are available after sign-in.</p>
            <button
              className="btn btn-primary"
              onClick={() =>
                openLogin(`${location.pathname}${location.search}`)
              }
            >
              Sign in <ArrowRight size={16} />
            </button>
          </div>
          {accountOpen && <LoginDialog onClose={closeLogin} />}
        </main>
      );
    }
    if (!user.roles.includes("CUSTOMER"))
      return <Navigate to="/admin" replace />;

    return (
      <Suspense fallback={<RouteLoading />}>
        <CustomerDashboard onOpenQuote={openQuote} />
        {quoteOpen && (
          <ShipmentQuote
            onClose={() => setQuoteOpen(false)}
            onLogin={() => openLogin("/dashboard?intent=quote")}
          />
        )}
      </Suspense>
    );
  }

  return (
    <>
      <Header
        accountHref={
          user?.roles.includes("CUSTOMER") ? "/dashboard" : "/customer/login"
        }
        onQuote={requestQuote}
      />
      <main>
        <Hero onQuote={requestQuote} />
        <Services onInquiry={setInquiryService} />
        <TrackingSection />
        <Destinations />
        <About onInquiry={setInquiryService} />
      </main>
      <Footer onInquiry={setInquiryService} />
      {accountOpen && <LoginDialog onClose={closeLogin} />}
      {inquiryService && (
        <ServiceInquiry
          service={inquiryService}
          onClose={() => setInquiryService(null)}
        />
      )}
      {quoteOpen && (
        <ShipmentQuote
          onClose={() => setQuoteOpen(false)}
          onLogin={() => openLogin("/dashboard?intent=quote")}
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
