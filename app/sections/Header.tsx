"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/hooks/useAuth'

interface HeaderProps {
  scrollRef: React.MutableRefObject<{ y: number; speed: number }>
  forceLight?: boolean
}

const navItems = ['Features', 'Agencies', 'Contact']
const sectionIds = ['#features', '#agencies', '#contact']

export default function Header({ scrollRef, forceLight = false }: HeaderProps) {
  const [isCompact, setIsCompact] = useState(false)
  const [overHeroRaw, setOverHeroRaw] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const check = () => {
      const y = scrollRef.current.y
      setIsCompact(y > 100)
      setOverHeroRaw(y < window.innerHeight * 0.85)
      rafRef.current = requestAnimationFrame(check)
    }
    rafRef.current = requestAnimationFrame(check)
    return () => cancelAnimationFrame(rafRef.current)
  }, [scrollRef])

  const overHero = overHeroRaw && !forceLight
  const { isAuthenticated, logout } = useAuth()

  const handleNavClick = (index: number) => {
    setMenuOpen(false)
    const target = document.querySelector(sectionIds[index])
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const textColor = overHero ? '#ffffff' : '#000000'
  const bgColor = overHero ? 'transparent' : '#ffffff'
  const borderColor = overHero ? 'rgba(255,255,255,0.18)' : '#000000'

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: isCompact ? '64px' : '88px',
          backgroundColor: menuOpen ? '#ffffff' : bgColor,
          borderBottom: menuOpen ? '1px solid #000000' : `1px solid ${borderColor}`,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(20px, 4vw, 60px)',
          transition:
            'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s ease, border-color 0.4s ease',
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '0.22em',
            cursor: 'pointer',
            color: menuOpen ? '#000000' : textColor,
            transition: 'color 0.4s ease',
          }}
          onClick={() => {
            setMenuOpen(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          PROPFLOW
        </div>

        {/* Desktop Nav — hidden on mobile */}
        <nav
          style={{ display: 'none', alignItems: 'stretch', height: '100%' }}
          className="md:flex"
        >
          {navItems.map((item, i) => (
            <NavItem
              key={item}
              label={item}
              overHero={overHero}
              onClick={() => handleNavClick(i)}
            />
          ))}
          {isAuthenticated ? (
            <NavItem
              label="Sign Out"
              overHero={overHero}
              onClick={() => { logout(); }}
            />
          ) : (
            <NavItem
              label="Sign In"
              overHero={overHero}
              onClick={() => { window.location.href = '/sign-in' }}
            />
          )}
        </nav>

        {/* Mobile Hamburger — shown only on mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '5px',
            width: '28px',
            height: '28px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          className="md:hidden"
          aria-label="Toggle menu"
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '2px',
              backgroundColor: menuOpen ? '#000000' : textColor,
              transition: 'transform 0.3s ease, background-color 0.3s ease',
              transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '2px',
              backgroundColor: menuOpen ? '#000000' : textColor,
              transition: 'opacity 0.3s ease, background-color 0.3s ease',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            style={{
              display: 'block',
              width: '100%',
              height: '2px',
              backgroundColor: menuOpen ? '#000000' : textColor,
              transition: 'transform 0.3s ease, background-color 0.3s ease',
              transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
            }}
          />
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            top: isCompact ? '64px' : '88px',
            left: 0,
            width: '100%',
            height: 'calc(100vh - 64px)',
            backgroundColor: '#ffffff',
            zIndex: 99,
            display: 'flex',
            flexDirection: 'column',
            padding: '32px clamp(20px, 4vw, 60px)',
            animation: 'slideDown 0.3s ease forwards',
          }}
          className="md:hidden"
        >
          {navItems.map((item, i) => (
            <MobileNavItem
              key={item}
              label={item}
              onClick={() => handleNavClick(i)}
            />
          ))}
          {isAuthenticated ? (
            <MobileNavItem
              label="Sign Out"
              onClick={() => { setMenuOpen(false); logout(); }}
            />
          ) : (
            <MobileNavItem
              label="Sign In"
              onClick={() => { window.location.href = '/sign-in' }}
            />
          )}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}

// ── Desktop Nav Item ──────────────────────────────────────────────────────

function NavItem({
  label,
  overHero,
  onClick,
}: {
  label: string
  overHero: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const baseColor = overHero ? '#ffffff' : '#000000'
  const hoverBg = overHero ? '#ffffff' : '#000000'
  const hoverFg = overHero ? '#000000' : '#ffffff'

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        fontSize: '13px',
        fontWeight: 400,
        letterSpacing: '0.08em',
        backgroundColor: hovered ? hoverBg : 'transparent',
        color: hovered ? hoverFg : baseColor,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.25s ease, color 0.25s ease',
        whiteSpace: 'nowrap',
        fontFamily: '"Helvetica Neue", sans-serif',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  )
}

// ── Mobile Nav Item ─────────────────────────────────────────────────────

function MobileNavItem({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '16px 0',
        fontSize: '14px',
        fontWeight: 400,
        letterSpacing: '0.12em',
        color: '#000000',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        cursor: 'pointer',
        textAlign: 'left',
        textTransform: 'uppercase',
        fontFamily: '"Helvetica Neue", sans-serif',
      }}
    >
      {label}
    </button>
  )
}