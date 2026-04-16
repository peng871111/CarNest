import { ContactForm } from "@/components/marketing/contact-form";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <section className="mb-10 rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Contact CarNest</p>
        <h1 className="mt-4 font-display text-5xl text-ink">Contact CarNest</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          Use the form below for listing questions, buyer enquiries, support requests, or warehouse storage discussions. We keep communication structured so every enquiry is reviewed properly.
        </p>
      </section>

      <ContactForm />
    </main>
  );
}
