import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PolicyLayout({ title, subtitle, sections }) {
  return (
    <div className="page-shell">
      <Navbar />

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
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
