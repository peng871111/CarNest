export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Terms</p>
        <h1 className="mt-4 font-display text-5xl text-ink">CarNest Terms of Service</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          Simple platform terms for buyers and sellers using CarNest.
        </p>
      </section>

      <section className="mt-12 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <div className="max-w-3xl space-y-8 text-sm leading-7 text-ink/68">
          <div>
            <h2 className="text-xl font-semibold text-ink">Using the platform</h2>
            <p className="mt-3">
              CarNest provides a platform for private buyers and sellers to connect around vehicle listings, offers,
              inspections, and related enquiries.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">User responsibility</h2>
            <p className="mt-3">
              Users are responsible for the accuracy, completeness, and legitimacy of the information they submit,
              including account details, listing content, pricing, and communication through the platform.
            </p>
            <p className="mt-3">
              Users must also comply with applicable Australian laws and regulatory requirements when listing or
              selling vehicles. Repeated vehicle selling activity within a 12-month period may, depending on the
              relevant jurisdiction and circumstances, require a dealer or motor trader licence or other regulatory
              approval.
            </p>
            <p className="mt-3">
              Where account or listing activity suggests a potential compliance risk, CarNest may review, restrict,
              suspend, or remove listings or accounts while that activity is assessed.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Listings and warehouse services</h2>
            <p className="mt-3">
              CarNest may remove listings, decline storage requests, or restrict platform access where information is
              incomplete, misleading, suspicious, or unsupported by sufficient ownership documentation.
            </p>
            <p className="mt-3">
              CarNest may refuse warehouse services if proof of ownership or supporting records are not provided when
              requested.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Independent transactions</h2>
            <p className="mt-3">
              Buyers and sellers transact independently. CarNest does not guarantee performance by either party and is
              not responsible for disputes arising from private sale negotiations, payment, delivery, or vehicle
              condition.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-ink">Platform misuse</h2>
            <p className="mt-3">
              Fraud, spam, misuse of platform workflows, suspicious behaviour, or attempts to misrepresent ownership or
              vehicle history may result in account restriction, listing removal, or refusal of service.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
