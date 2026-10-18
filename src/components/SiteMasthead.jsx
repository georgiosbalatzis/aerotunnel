import { useEffect, useId, useRef, useState } from 'react';
import F1Logo from './F1Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { SITE_NAV_LINKS, SITE_URL } from './siteNav.js';

function SiteLinks({ onNavigate }) {
  return SITE_NAV_LINKS.map(link => (
    <a key={link.label} href={link.href} onClick={onNavigate}
      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {link.label}
      {link.external && <span className="visually-hidden"> (opens in a new tab)</span>}
    </a>
  ));
}

export default function SiteMasthead() {
  const menuId = useId();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => menuRef.current?.hidePopover();

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 992px)');
    const closeOnDesktop = () => { if (desktop.matches) menuRef.current?.hidePopover(); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <header className="site-masthead" onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
    }}>
      <a className="skip-link" href="#aerotunnel-main">Skip to AeroTunnel workspace</a>
      <div className="site-masthead__inner">
        <a className="site-brand" href={`${SITE_URL}/`} aria-label="F1 Stories home">
          <F1Logo size={48} />
          <span aria-hidden="true">F1 STORIES<span className="site-brand__dot">.</span></span>
        </a>
        <nav className="site-links" aria-label="F1 Stories main navigation" lang="el">
          <SiteLinks />
        </nav>
        <div className="site-masthead__actions">
          <ThemeToggle />
          <button type="button" className="site-menu-button" popoverTarget={menuId}
            aria-label="F1 Stories menu" aria-controls={menuId} aria-expanded={menuOpen}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>
      <nav ref={menuRef} id={menuId} popover="auto" className="site-mobile-menu"
        aria-label="F1 Stories mobile navigation" lang="el"
        onToggle={event => setMenuOpen(event.nativeEvent.newState === 'open')}>
        <SiteLinks onNavigate={closeMenu} />
      </nav>
    </header>
  );
}
