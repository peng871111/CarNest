export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Privacy</p>
        <h1 className="mt-4 font-display text-5xl text-ink">CarNest Privacy Policy</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          A lightweight overview of how CarNest handles account, listing, and enquiry information.
        </p>
      </section>

      <section className="mt-12 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <div className="max-w-3xl space-y-8 text-sm leading-7 text-ink/68">
          <div>
            <h2 className="text-xl font-semibold text-ink">Information CarNest collects</h2>
            <p className="mt-3">
              CarNest collects information users submit through accounts, forms, listings, offers, inspections,
              enquiries, and seller support requests.
            </p>
            <p className="mt-3">
              This may include name, email, phone, account details, listing data, offer submissions, inspection
              requests, enquiry messages, and approximate usage or location analytics where available.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">How CarNest uses information</h2>
            <p className="mt-3">
              CarNest uses submitted information to operate the platform, coordinate communication between buyers and
              sellers, manage listings and support workflows, respond to enquiries, and improve platform performance.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Analytics and location data</h2>
            <p className="mt-3">
              If analytics are used, they are intended to remain approximate and privacy-safe. CarNest does not use
              those analytics to identify precise residential addresses of buyers or viewers.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Data sharing</h2>
            <p className="mt-3">
              CarNest does not sell personal data. Contact details are used to manage legitimate platform activity and
              are not publicly exposed beyond the workflows required to coordinate buyer and seller interaction.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Privacy questions</h2>
            <p className="mt-3">
              Users may contact CarNest through the platform enquiry channels if they have privacy-related questions or
              concerns about submitted information.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
