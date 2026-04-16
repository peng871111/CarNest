export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <section className="rounded-[36px] border border-black/5 bg-hero-glow p-10 shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-bronze">Disclaimer</p>
        <h1 className="mt-4 font-display text-5xl text-ink">CarNest Disclaimer</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/68">
          Important information about how the CarNest platform operates and where buyer and seller responsibility
          remains.
        </p>
      </section>

      <section className="mt-12 rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
        <div className="max-w-3xl space-y-5 text-sm leading-7 text-ink/68">
          <p>CarNest is a platform that connects private vehicle sellers and buyers.</p>
          <p>CarNest does not own, inspect, or guarantee any vehicles listed on the platform unless explicitly stated.</p>
          <p>All vehicle information is provided by the seller and should be independently verified by the buyer.</p>
          <p>
            CarNest is not a licensed motor vehicle dealer and does not act as an agent in the sale transaction unless
            otherwise specified.
          </p>
          <p>All transactions are conducted directly between buyer and seller.</p>
          <p>
            Vehicles stored at the CarNest warehouse may receive additional presentation support, but this does not
            constitute a mechanical inspection, certification, or guarantee unless explicitly stated.
          </p>
          <p>Buyers are encouraged to conduct independent inspections prior to purchase.</p>
          <p>
            For vehicles listed on the platform but not stored with CarNest, all information is provided by the seller.
          </p>
          <p>
            CarNest does not verify ownership, financial encumbrances, or vehicle condition for standard listings.
          </p>
          <p>
            Buyers are responsible for conducting their own due diligence, including ownership and financial checks.
          </p>
          <p>Vehicles submitted for CarNest warehouse storage must meet additional requirements.</p>
          <p>
            Sellers are required to provide valid proof of ownership upon request before a vehicle is accepted into
            storage.
          </p>
          <p>
            CarNest reserves the right to refuse or remove any listing if sufficient proof of ownership documentation
            cannot be provided.
          </p>
          <p>
            CarNest reserves the right to refuse storage or remove any vehicle if sufficient proof of ownership
            documentation cannot be provided.
          </p>
          <p>Sellers are responsible for disclosing any financial encumbrances associated with the vehicle.</p>
          <p>CarNest does not verify or guarantee the financial status of vehicles listed on the platform.</p>
          <p>
            CarNest is not liable for any loss, damage, or dispute arising from transactions conducted through the
            platform.
          </p>
        </div>
      </section>
    </main>
  );
}
