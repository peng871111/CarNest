export interface SellingTip {
  slug: string;
  title: string;
  summary: string;
  body: string[];
}

export const SELLING_TIPS: SellingTip[] = [
  {
    slug: "price-your-car-correctly",
    title: "How to price your car correctly",
    summary: "Start with a realistic asking price based on condition, mileage, service history, and comparable listings.",
    body: [
      "Review comparable vehicles with similar year, mileage, condition, and specification before setting your price.",
      "Be realistic about cosmetic wear, missing history, or overdue maintenance, because buyers will usually factor those issues into their offers.",
      "If you want room to negotiate, build that in carefully rather than starting so high that serious buyers skip the listing entirely."
    ]
  },
  {
    slug: "take-better-listing-photos",
    title: "How to take better photos for your listing",
    summary: "Clear, well-lit photos can lift buyer confidence before the first enquiry arrives.",
    body: [
      "Photograph the car in soft daylight, with a clean background and enough space to capture full exterior angles.",
      "Include interior, wheels, odometer, service books, and any standout features buyers are likely to care about.",
      "Show the vehicle honestly. A clean presentation matters, but hiding obvious marks or damage usually creates friction later."
    ]
  },
  {
    slug: "prepare-documents-before-selling",
    title: "What documents to prepare before selling",
    summary: "Having the right paperwork ready makes inspections and serious negotiations move much faster.",
    body: [
      "Gather registration details, service records, receipts, finance clearance if relevant, and any roadworthy or inspection paperwork you already have.",
      "Keep both keys, owner manuals, and any warranty or accessory documents together so buyers can assess the full package quickly.",
      "If anything is missing, note it clearly in your listing so buyers know what to expect before they make an offer."
    ]
  },
  {
    slug: "avoid-lowball-offers",
    title: "How to avoid lowball offers",
    summary: "A stronger listing and a clearer pricing position can reduce time wasted on unserious offers.",
    body: [
      "Lowball offers often happen when the asking price feels uncertain or the listing leaves too many unanswered questions.",
      "Use accurate photos, complete specifications, and a clear summary of condition so buyers understand the car before negotiating.",
      "If offers come in well below expectations, respond calmly, restate the vehicle’s strengths, and decide whether the buyer is worth engaging further."
    ]
  },
  {
    slug: "write-a-stronger-description",
    title: "How to write a stronger listing description",
    summary: "A strong description helps buyers understand the car, its condition, and why it deserves attention.",
    body: [
      "Lead with the essentials: model, ownership context, condition, service history, and any meaningful factory or optional features.",
      "Use simple, factual language instead of hype. Buyers respond better to clarity than to exaggerated claims.",
      "Mention anything that materially affects value or convenience, including recent servicing, tyre condition, cosmetic flaws, or outstanding maintenance."
    ]
  }
];
