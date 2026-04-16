const FAQS = [
  {
    question: "Is CarNest free to use?",
    answer: "CarNest supports a standard online listing path, and some optional support services may involve a separate quote depending on the level of help requested."
  },
  {
    question: "What is the difference between online listing and secure warehouse storage?",
    answer: "Online listing keeps the vehicle with the seller, while secure warehouse storage adds optional CarNest-managed storage and more flexible inspection handling."
  },
  {
    question: "How do offers work?",
    answer: "Buyers can submit offers through the vehicle page, and those offers are recorded for the seller or admin workflow to review."
  },
  {
    question: "Does CarNest handle payment?",
    answer: "No. CarNest does not act as a financial intermediary, and buyers and sellers complete negotiation and payment directly."
  },
  {
    question: "Can I list my car without warehouse storage?",
    answer: "Yes. Sellers can submit an online listing only and keep the vehicle with them."
  },
  {
    question: "How does CarNest contact me after I request a quote?",
    answer: "CarNest reviews the submitted request and responds directly using the contact details attached to your listing or enquiry."
  },
  {
    question: "Can buyers inspect a warehouse vehicle?",
    answer: "Yes. Warehouse vehicles are designed for managed inspection access, usually by appointment once the inspection process is approved."
  }
];

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Frequently Asked Questions</p>
        <h1 className="mt-4 font-display text-5xl text-ink">Frequently Asked Questions</h1>
      </section>

      <section className="mt-12 space-y-5">
        {FAQS.map((item) => (
          <article key={item.question} className="rounded-[28px] border border-black/5 bg-white p-7 shadow-panel">
            <h2 className="text-2xl font-semibold text-ink">{item.question}</h2>
            <p className="mt-4 text-sm leading-7 text-ink/65">{item.answer}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
