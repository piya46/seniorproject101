import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { getAuthenticatedUser } from '../lib/auth';

export default function PolicyLayout({ title, subtitle, sections, updatedAt, children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      const authenticatedUser = await getAuthenticatedUser();
      if (!isMounted) {
        return;
      }
      setIsAuthenticated(Boolean(authenticatedUser));
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-shell bg-[#FCF8F3]">
      {isAuthenticated ? (
        <Navbar />
      ) : (
        <header className="border-b border-[#E7D7C5] bg-white/90 backdrop-blur">
          <div className="page-gutter content-reading flex items-center gap-3 py-2">
            <img
              src="/Logo.png"
              alt="Form Check"
              className="h-24 w-24 rounded-xl object-contain"
              data-protect-ui="true"
              draggable={false}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A36A35]">
                Form Check
              </p>
              <p className="text-sm text-[#6F6F6F]">
                Public policy page
              </p>
            </div>
          </div>
        </header>
      )}

      <main className="page-gutter content-reading flex-1 py-8 sm:py-12">
        <div className="rounded-[28px] border border-[#E7D7C5] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A36A35]">
            Policy
          </p>
          <h1 className="mt-3 text-[28px] font-extrabold text-[#7B542F] sm:text-[34px]">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6F6F6F] sm:text-[15px]">
            {subtitle}
          </p>
          {updatedAt ? (
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[#9C846A]">
              ปรับปรุงล่าสุด: {updatedAt}
            </p>
          ) : null}

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.heading} className="rounded-2xl bg-[#FFF9F3] px-5 py-5 sm:px-6">
                <h2 className="text-lg font-bold text-[#7B542F]">{section.heading}</h2>
                {section.body ? (
                  <p className="mt-3 text-sm leading-7 text-[#4D4D4D] sm:text-[15px]">
                    {section.body}
                  </p>
                ) : null}
                {section.points?.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#4D4D4D] sm:text-[15px]">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
