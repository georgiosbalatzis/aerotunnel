import { useEffect, useRef } from 'react';
import { RACE_DESK_LINKS } from './siteNav.js';

export default function RaceDeskNav() {
  const currentLink = useRef(null);
  useEffect(() => {
    const list = currentLink.current?.parentElement;
    if (list) list.scrollLeft = list.scrollWidth - list.clientWidth;
  }, []);
  return (
    <nav className="race-desk-nav" aria-label="Race Desk" lang="en">
      <div className="race-desk-nav__inner">
        <div className="race-desk-nav__label">
          <span>RACE DESK</span>
          <span className="race-desk-nav__hint">5 apps · scroll to explore</span>
        </div>
        <div className="race-desk-nav__links">
          {RACE_DESK_LINKS.map(link => (
            <a key={link.label} href={link.current ? `${import.meta.env.BASE_URL}#aerotunnel-main` : link.href}
              aria-current={link.current ? 'page' : undefined} ref={link.current ? currentLink : undefined}
              onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
