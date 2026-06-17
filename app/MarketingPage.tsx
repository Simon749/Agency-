"use client"
// app/MarketingPage.tsx
// Your existing marketing page — moved here so app/page.tsx can be a server component.
// Zero logic changes.
import { useEffect, useRef, useState } from "react";
import Header from "./sections/Header";
import Hero from "./sections/Hero";
import Philosophy from "./sections/Philosophy";
import Works from "./sections/Works";
import Capabilities from "./sections/Capabilities";
import Spatial from "./sections/Spatial";
import Footer from "./sections/Footer";
import Preloader from "./sections/Preloader";
import RoomDetail from "@/app/pages/RoomDetail";

export default function MarketingPage() {
  const scrollRef = useRef({ y: 0, speed: 0 });
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    let rafId: number;
    let prevY = window.scrollY;
    const tick = () => {
      const y = window.scrollY;
      scrollRef.current.y = y;
      scrollRef.current.speed = y - prevY;
      prevY = y;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleSelectRoom = (id: string) => setCurrentRoomId(id);
  const handleBack = () => {
    setCurrentRoomId(null);
    setTimeout(() => {
      document.querySelector("#works")?.scrollIntoView({ behavior: "auto" });
    }, 0);
  };

  return (
    <>
      <Preloader onDone={() => {}} />
      <Header scrollRef={scrollRef} forceLight={currentRoomId !== null} />
      {currentRoomId ? (
        <RoomDetail roomId={currentRoomId} onBack={handleBack} />
      ) : (
        <main>
          <Spatial />
          <Philosophy />
          <Works scrollRef={scrollRef} onSelectRoom={handleSelectRoom} />
          <Capabilities />
          <Hero />
        </main>
      )}
      <Footer />
    </>
  );
}