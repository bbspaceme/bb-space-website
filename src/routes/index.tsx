import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import landingCss from "@/styles/landing.css?raw";
import landingHtml from "@/styles/landing-body.html?raw";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KBAI — Investment Operating System" },
      {
        name: "description",
        content:
          "KBAI adalah sistem intelijen investasi multi-layer untuk advisor, komunitas, dan investor yang ingin mengambil keputusan berbasis data.",
      },
      { property: "og:title", content: "KBAI — Investment Operating System" },
      {
        property: "og:description",
        content:
          "Kelola portofolio dengan sistem, bukan feeling. Framework 5-layer, trigger engine, dan community alpha.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject scoped landing stylesheet only while this route is mounted
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-landing", "true");
    styleEl.textContent = landingCss;
    document.head.appendChild(styleEl);

    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Instrument+Sans:wght@300;400;500;600&family=Syne:wght@400;600;700;800&display=swap";
    fontLink.setAttribute("data-landing", "true");
    document.head.appendChild(fontLink);

    return () => {
      styleEl.remove();
      fontLink.remove();
    };
  }, []);

  // Wire up scroll-reveal, nav scroll, smooth-anchor, ticker animation, and route Login/CTA
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const navEl = root.querySelector<HTMLElement>("#nav");
    const onScroll = () => {
      navEl?.classList.toggle("scrolled", window.scrollY > 50);
    };
    window.addEventListener("scroll", onScroll);
    onScroll();

    const reveals = root.querySelectorAll(".reveal");
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    reveals.forEach((el) => revealObs.observe(el));

    const chartObs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => {
            root.querySelectorAll(".chart-line").forEach((l) => l.classList.add("drawn"));
          }, 300);
          chartObs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    const chartContainer = root.querySelector(".chart-container");
    if (chartContainer) chartObs.observe(chartContainer);

    // Smooth-scroll for hash anchors
    const anchorHandler = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#") && href.length > 1) {
        const target = root.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener("click", anchorHandler));

    // Route Login + CTA buttons (and any non-hash links) to /login
    const loginNav = (e: Event) => {
      e.preventDefault();
      navigate({ to: "/login" });
    };
    const cta = root.querySelectorAll<HTMLAnchorElement>(
      ".nav-login, .nav-cta, .btn-primary, .final-actions .btn-ghost",
    );
    cta.forEach((el) => el.addEventListener("click", loginNav));

    // Ticker subtle update
    const tickerInterval = window.setInterval(() => {
      root.querySelectorAll<HTMLElement>(".ticker-value").forEach((el) => {
        const raw = (el.textContent || "").replace(/,/g, "");
        const num = parseFloat(raw);
        if (!isNaN(num) && num > 100) {
          const delta = (Math.random() - 0.5) * 0.0008 * num;
          el.textContent = (num + delta).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          });
        }
      });
    }, 5000);

    const dotIntervals: number[] = [];
    root.querySelectorAll<HTMLElement>(".t-dot.active").forEach((dot) => {
      const id = window.setInterval(() => {
        dot.style.opacity = Math.random() > 0.15 ? "1" : "0.5";
      }, 1800);
      dotIntervals.push(id);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      revealObs.disconnect();
      chartObs.disconnect();
      anchors.forEach((a) => a.removeEventListener("click", anchorHandler));
      cta.forEach((el) => el.removeEventListener("click", loginNav));
      window.clearInterval(tickerInterval);
      dotIntervals.forEach((id) => window.clearInterval(id));
    };
  }, [navigate]);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: landingHtml }} />;
}
