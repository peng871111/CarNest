import {
  SaleHandoverBuyerSnapshot,
  SaleHandoverConfirmations,
  SaleHandoverPdfSnapshot,
  SaleHandoverPreparationChecklist,
  SaleHandoverRecord,
  SaleHandoverRecordStatus,
  SaleHandoverSellerSnapshot,
  SaleHandoverSourceSnapshot,
  SaleHandoverTransactionDetails,
  SaleHandoverVehicleSnapshot,
  Vehicle,
  VehicleActor,
  VehicleRecord,
  WarehouseIntakeRecord,
} from "@/types";
import { getVehicleDisplayReference } from "@/lib/utils";

export const SALE_HANDOVER_TERMS_VERSION = "2026-07-31-v1";
export const SALE_HANDOVER_TIMEZONE = "Australia/Melbourne";

export const SALE_HANDOVER_PREPARATION_LABELS: Array<[keyof SaleHandoverPreparationChecklist, string]> = [
  ["roadworthyCertificate", "Roadworthy Certificate"],
  ["paintCorrection", "Paint correction"],
  ["wheelRepair", "Wheel repair"],
  ["professionalDetail", "Professional detail"],
  ["ceramicCoating", "Ceramic coating"],
  ["dentRepair", "Dent repair"],
  ["windscreenRepair", "Windscreen repair"],
  ["batteryReplacement", "Battery replacement"],
  ["other", "Other"],
];

export const SALE_HANDOVER_AGREEMENT_TERMS = [
  {
    title: "1. Purpose of this record",
    paragraphs: [
      "This document records information supplied by the Seller and Buyer concerning a private vehicle sale and handover. It is intended to assist the parties with their transaction records and their own vehicle-transfer process.",
      "This document does not itself transfer vehicle registration and does not replace any VicRoads Notice of Disposal, registration transfer requirement, Roadworthy Certificate, payment obligation or other government process.",
    ],
  },
  {
    title: "2. Parties to the sale",
    paragraphs: [
      "The Seller and Buyer identified on page 1 are the parties to the vehicle sale.",
      "The Seller sells the Vehicle directly to the Buyer, and the Buyer purchases the Vehicle directly from the Seller.",
    ],
  },
  {
    title: "3. CarNest administrative role",
    paragraphs: [
      "CarNest prepared this document as an administrative template and information summary at the request of the parties.",
      "CarNest is not the buyer, seller or owner of the Vehicle under this document and is not a party to the vehicle sale.",
      "CarNest does not, merely by preparing this document, transfer registration, guarantee payment, guarantee ownership, guarantee the Vehicle's condition or assume the obligations of the Seller or Buyer.",
      "Nothing in this clause excludes responsibility for any representation, conduct or service supplied by CarNest itself, or any right or liability that cannot lawfully be excluded.",
    ],
  },
  {
    title: "4. Seller declarations",
    paragraphs: [
      "The Seller declares that they are the legal owner of the Vehicle or have written authority from the legal owner to sell it.",
      "The Seller confirms that the ownership, registration, VIN or chassis number, odometer and other information supplied for this record is accurate to the best of their knowledge.",
      "The Seller must disclose any known finance, security interest, ownership dispute, registration restriction, stolen status, written-off status or other matter that may affect ownership or lawful transfer of the Vehicle.",
      "The Seller remains responsible for discharging any security interest and providing evidence of discharge where applicable.",
    ],
  },
  {
    title: "5. Buyer acknowledgements",
    paragraphs: [
      "The Buyer acknowledges having had a reasonable opportunity to inspect the Vehicle, review the available information and arrange an independent mechanical inspection or vehicle-history search before completing the transaction.",
      "A Certificate of Roadworthiness relates to road-safety requirements at the time of inspection. It is not a comprehensive mechanical inspection or a guarantee of future reliability.",
      "Nothing in this document excludes rights relating to fraud, deliberate concealment, misleading or deceptive conduct, defective title or any legal right that cannot validly be excluded.",
    ],
  },
  {
    title: "6. Roadworthy Certificate and registration",
    paragraphs: [
      "If the Vehicle is registered and a current Certificate of Roadworthiness is required, the Seller is responsible for providing it to the Buyer.",
      "If the Vehicle is sold unregistered, that status must be clearly recorded on page 1.",
      "The parties remain responsible for confirming whether an exemption applies.",
    ],
  },
  {
    title: "7. VicRoads transfer responsibilities",
    paragraphs: [
      "The Seller and Buyer remain responsible for completing the applicable VicRoads transfer and registration steps within the required timeframes.",
      "The Seller remains responsible for submitting or completing the required Notice of Disposal.",
      "The Buyer remains responsible for completing the buyer's transfer requirements, paying applicable government transfer fees and motor vehicle duty, and supplying any required supporting documents.",
      "Each party should retain a copy of this record and any VicRoads transfer confirmation.",
    ],
  },
  {
    title: "8. PPSR information",
    paragraphs: [
      "The Buyer is encouraged to conduct a current PPSR motor vehicle search using the Vehicle's VIN or chassis number before completing the purchase.",
      "A PPSR search may identify registered security interests and may include stolen or written-off information, but it does not provide every item of the Vehicle's history.",
    ],
  },
  {
    title: "9. Payment and handover",
    paragraphs: [
      "The purchase price, deposit, balance, payment method and handover details are recorded on page 1.",
      "Unless the parties record another arrangement in writing, purchase monies are paid directly between the Buyer and Seller.",
      "CarNest does not receive or hold the purchase price merely because it prepared this record.",
      "Vehicle possession, keys and documents should only be released in accordance with the payment and handover arrangements agreed by the Seller and Buyer.",
    ],
  },
  {
    title: "10. Vehicle preparation information",
    paragraphs: [
      "Any preparation work listed on page 1 records work requested, arranged or reported as completed.",
      "Unless expressly stated in a separate written service or warranty document, the preparation checklist is not a comprehensive mechanical inspection, valuation, warranty or guarantee.",
    ],
  },
  {
    title: "11. Electronic signatures",
    paragraphs: [
      "The Seller and Buyer consent to receiving, signing and retaining this record electronically.",
      "Each electronic signature is intended to identify the signing party and indicate that party's approval of the version presented at the time of signing.",
      "After signing, no material field may be altered without creating a new document version or written amendment for approval by the affected parties.",
    ],
  },
  {
    title: "12. Non-excludable rights",
    paragraphs: [
      "Nothing in this record excludes, restricts or modifies any right, remedy, obligation or liability that cannot lawfully be excluded, restricted or modified.",
    ],
  },
  {
    title: "13. Governing law",
    paragraphs: [
      "This record is governed by the laws of Victoria, Australia.",
    ],
  },
] as const;

function cleanText(value?: string | number | null) {
  return String(value ?? "").trim();
}

function parseMoney(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function getActorDisplayName(actor?: Pick<VehicleActor, "displayName" | "name" | "email"> | null) {
  return actor?.displayName || actor?.name || actor?.email || "CarNest Admin";
}

export function isWarehouseManagedListing(vehicle?: Vehicle | null) {
  if (!vehicle) return false;
  const extended = vehicle as Vehicle & { managementType?: string; isManagedByCarnest?: boolean };
  return vehicle.listingType === "warehouse" || vehicle.storedInWarehouse === true || extended.managementType === "warehouse" || extended.isManagedByCarnest === true;
}

export function createEmptySaleHandoverSeller(): SaleHandoverSellerSnapshot {
  return {
    customerId: "",
    legalName: "",
    phone: "",
    email: "",
    address: "",
    suburb: "",
    state: "VIC",
    postcode: "",
    ownershipAuthorityConfirmed: false,
  };
}

export function createEmptySaleHandoverBuyer(): SaleHandoverBuyerSnapshot {
  return {
    buyerType: "individual",
    buyerCustomerId: "",
    createOrLinkCustomerProfile: false,
    legalFirstName: "",
    legalFamilyName: "",
    companyLegalName: "",
    acn: "",
    authorisedRepresentativeName: "",
    phone: "",
    email: "",
    address: "",
    suburb: "",
    state: "VIC",
    postcode: "",
    vicRoadsCustomerNumber: "",
    driverLicenceNumber: "",
  };
}

export function createEmptySaleHandoverVehicle(): SaleHandoverVehicleSnapshot {
  return {
    listingId: "",
    listingReference: "",
    vehicleRecordId: "",
    year: "",
    make: "",
    model: "",
    variant: "",
    colour: "",
    registrationNumber: "",
    registrationStatus: "unknown",
    registrationExpiry: "",
    vinOrChassis: "",
    engineNumber: "",
    odometerAtAgreement: "",
    odometerAtHandover: "",
    keysSupplied: "",
  };
}

export function createEmptySaleHandoverPreparation(): SaleHandoverPreparationChecklist {
  return {
    roadworthyCertificate: false,
    paintCorrection: false,
    wheelRepair: false,
    professionalDetail: false,
    ceramicCoating: false,
    dentRepair: false,
    windscreenRepair: false,
    batteryReplacement: false,
    other: false,
    otherNotes: "",
  };
}

export function createEmptySaleHandoverTransaction(): SaleHandoverTransactionDetails {
  return {
    purchasePrice: 0,
    deposit: 0,
    balance: 0,
    balanceOverrideEnabled: false,
    balanceOverrideReason: "",
    paymentMethod: "",
    paymentArrangement: "",
    saleDate: "",
    settlementDate: "",
    handoverDate: "",
    handoverTime: "",
    handoverLocation: "",
    documentsSupplied: "",
    additionalTerms: "",
  };
}

export function createEmptySaleHandoverConfirmations(): SaleHandoverConfirmations {
  return {
    sellerInformationReviewed: false,
    buyerInformationReviewed: false,
    vehicleInformationReviewed: false,
    noVicRoadsTransferAcknowledged: false,
    termsProvided: false,
  };
}

export function createEmptySaleHandoverSourceSnapshot(): SaleHandoverSourceSnapshot {
  return {
    importedFromStorageContract: false,
    importedAt: "",
    importedByUid: "",
    importedByName: "",
    storageContractId: "",
    fieldSources: {},
    warnings: [],
  };
}

export function getSaleHandoverBuyerDisplayName(buyer: SaleHandoverBuyerSnapshot) {
  if (buyer.buyerType === "company") {
    return cleanText(buyer.companyLegalName) || cleanText(buyer.authorisedRepresentativeName) || "Buyer";
  }
  return [buyer.legalFirstName, buyer.legalFamilyName].map(cleanText).filter(Boolean).join(" ") || "Buyer";
}

export function maskSensitiveIdentifier(value?: string | null) {
  const normalized = cleanText(value);
  if (!normalized) return "";
  const visible = normalized.replace(/\s+/g, "").slice(-4);
  return visible ? `•••• ${visible}` : "";
}

export function calculateSaleHandoverBalance(transaction: SaleHandoverTransactionDetails) {
  if (transaction.balanceOverrideEnabled) {
    return parseMoney(transaction.balance);
  }
  return Math.max(parseMoney(transaction.purchasePrice) - parseMoney(transaction.deposit), 0);
}

export function createSaleHandoverRecordNumber(recordId: string, now = new Date()) {
  const suffix = recordId.replace(/[^0-9A-Za-z]/g, "").slice(-6).toUpperCase().padStart(6, "0");
  return `CN-SH-${now.getFullYear()}-${suffix}`;
}

export function getSaleHandoverActionLabel(record?: SaleHandoverRecord | null) {
  if (!record) return "Create Sale & Handover Record";
  if (record.pdf?.storagePath) return "View PDF";
  if (record.status === "signed") return "View Signed Record";
  if (record.status === "ready_for_signature" || record.status === "partially_signed") return "Review & Sign Record";
  return "Continue Sale & Handover Record";
}

export function importSaleHandoverSnapshots(input: {
  recordId: string;
  listing: Vehicle;
  storageContract?: WarehouseIntakeRecord | null;
  vehicleRecord?: VehicleRecord | null;
  actor?: VehicleActor | null;
  now?: string;
}): Omit<SaleHandoverRecord, "id"> {
  const now = input.now || new Date().toISOString();
  const actorName = getActorDisplayName(input.actor);
  const storageContract = input.storageContract ?? null;
  const vehicleRecord = input.vehicleRecord ?? null;
  const listing = input.listing;
  const recordNumber = createSaleHandoverRecordNumber(input.recordId, new Date(now));
  const seller = createEmptySaleHandoverSeller();
  const vehicle = createEmptySaleHandoverVehicle();
  const fieldSources: Record<string, string> = {};
  const warnings: string[] = [];

  if (storageContract) {
    seller.customerId = storageContract.customerProfileId || "";
    seller.legalName = storageContract.ownerDetails.fullName || "";
    seller.phone = storageContract.ownerDetails.phone || "";
    seller.email = storageContract.ownerDetails.email || "";
    seller.address = storageContract.ownerDetails.address || "";
    seller.ownershipAuthorityConfirmed = storageContract.ownerDetails.isLegalOwnerConfirmed === true;
    ["seller.legalName", "seller.phone", "seller.email", "seller.address", "seller.ownershipAuthorityConfirmed"].forEach((key) => {
      fieldSources[key] = "Imported from linked Storage Contract";
    });
  } else {
    warnings.push("No linked Storage Contract was found. Seller information must be entered and verified manually before this record can be signed or finalised.");
    warnings.push("No linked Storage Contract was found. Vehicle details must be entered and verified manually before this record can be signed or finalised.");
  }

  const sourceVehicle = storageContract?.vehicleDetails;
  vehicle.listingId = listing.id;
  vehicle.listingReference = getVehicleDisplayReference(listing);
  vehicle.vehicleRecordId = vehicleRecord?.id || storageContract?.vehicleRecordId || "";
  vehicle.year = cleanText(vehicleRecord?.year) || cleanText(sourceVehicle?.year) || cleanText(listing.year);
  vehicle.make = cleanText(vehicleRecord?.make) || cleanText(sourceVehicle?.make) || cleanText(listing.make);
  vehicle.model = cleanText(vehicleRecord?.model) || cleanText(sourceVehicle?.model) || cleanText(listing.model);
  vehicle.variant = cleanText(vehicleRecord?.variant) || cleanText(sourceVehicle?.variant) || cleanText(listing.variant);
  vehicle.colour = cleanText(vehicleRecord?.colour) || cleanText(sourceVehicle?.colour) || cleanText(listing.colour);
  vehicle.registrationNumber = cleanText(vehicleRecord?.registrationPlate) || cleanText(sourceVehicle?.registrationPlate) || cleanText(listing.rego);
  vehicle.registrationStatus = vehicle.registrationNumber ? "registered" : "unknown";
  vehicle.registrationExpiry = cleanText(vehicleRecord?.registrationExpiry) || cleanText(sourceVehicle?.registrationExpiry) || cleanText(listing.regoExpiry);
  vehicle.vinOrChassis = cleanText(vehicleRecord?.vin) || cleanText(sourceVehicle?.vin) || cleanText(listing.vin);
  vehicle.engineNumber = "";
  vehicle.odometerAtAgreement = cleanText(vehicleRecord?.odometer) || cleanText(sourceVehicle?.odometer) || cleanText(listing.mileage);
  vehicle.odometerAtHandover = "";
  vehicle.keysSupplied = cleanText(vehicleRecord?.numberOfKeys) || cleanText(sourceVehicle?.numberOfKeys) || cleanText(listing.keyCount);

  if (storageContract || vehicleRecord) {
    [
      "vehicle.year",
      "vehicle.make",
      "vehicle.model",
      "vehicle.variant",
      "vehicle.colour",
      "vehicle.registrationNumber",
      "vehicle.registrationExpiry",
      "vehicle.vinOrChassis",
      "vehicle.odometerAtAgreement",
      "vehicle.keysSupplied",
    ].forEach((key) => {
      fieldSources[key] = vehicleRecord ? "Imported from linked Vehicle record" : "Imported from linked Storage Contract";
    });
  }

  const transaction = createEmptySaleHandoverTransaction();
  transaction.purchasePrice = parseMoney(listing.price);
  transaction.balance = calculateSaleHandoverBalance(transaction);

  return {
    recordNumber,
    status: "draft",
    listingId: listing.id,
    vehicleId: listing.id,
    vehicleRecordId: vehicle.vehicleRecordId,
    storageContractId: storageContract?.id || "",
    sellerCustomerId: seller.customerId || "",
    buyerCustomerId: "",
    seller,
    buyer: createEmptySaleHandoverBuyer(),
    vehicle,
    preparation: createEmptySaleHandoverPreparation(),
    transaction,
    confirmations: createEmptySaleHandoverConfirmations(),
    sellerSignature: null,
    buyerSignature: null,
    documentVersion: 1,
    agreementTermsVersion: SALE_HANDOVER_TERMS_VERSION,
    sourceSnapshot: {
      importedFromStorageContract: Boolean(storageContract),
      importedAt: now,
      importedByUid: input.actor?.id || "",
      importedByName: actorName,
      storageContractId: storageContract?.id || "",
      fieldSources,
      warnings,
    },
    pdf: null,
    pdfHistory: [],
    previousVersions: [],
    preparedByUid: input.actor?.id || "",
    preparedByName: actorName,
    lastEditedByUid: input.actor?.id || "",
    lastEditedByName: actorName,
    lastEditedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSaleHandoverVehicleTitle(record: Pick<SaleHandoverRecord, "vehicle">) {
  return [record.vehicle.year, record.vehicle.make, record.vehicle.model, record.vehicle.variant].map(cleanText).filter(Boolean).join(" ") || "Vehicle";
}

export function getSaleHandoverMissingRequiredFields(record: SaleHandoverRecord | Omit<SaleHandoverRecord, "id">) {
  const missing: string[] = [];
  const sellerContact = cleanText(record.seller.phone) || cleanText(record.seller.email);
  const buyerContact = cleanText(record.buyer.phone) || cleanText(record.buyer.email);
  const buyerName = getSaleHandoverBuyerDisplayName(record.buyer);
  const hasRegistration = cleanText(record.vehicle.registrationNumber) || record.vehicle.registrationStatus === "unregistered";

  if (!cleanText(record.seller.legalName)) missing.push("Seller legal name");
  if (!cleanText(record.seller.address)) missing.push("Seller address");
  if (!sellerContact) missing.push("Seller phone or email");
  if (!record.seller.ownershipAuthorityConfirmed) missing.push("Seller ownership or written authority confirmation");
  if (!buyerName || buyerName === "Buyer") missing.push("Buyer legal or company name");
  if (!cleanText(record.buyer.address)) missing.push("Buyer address");
  if (!buyerContact) missing.push("Buyer phone or email");
  if (!cleanText(record.vehicle.year)) missing.push("Vehicle year");
  if (!cleanText(record.vehicle.make)) missing.push("Vehicle make");
  if (!cleanText(record.vehicle.model)) missing.push("Vehicle model");
  if (!cleanText(record.vehicle.vinOrChassis)) missing.push("VIN or chassis number");
  if (!hasRegistration) missing.push("Registration number or explicit Unregistered status");
  if (!cleanText(record.vehicle.odometerAtAgreement)) missing.push("Odometer");
  if (parseMoney(record.transaction.purchasePrice) <= 0) missing.push("Purchase price");
  if (!cleanText(record.transaction.saleDate)) missing.push("Sale date");
  if (!cleanText(record.transaction.handoverDate) && !cleanText(record.transaction.handoverLocation)) missing.push("Handover arrangement");
  if (!cleanText(record.transaction.paymentMethod) && !cleanText(record.transaction.paymentArrangement)) missing.push("Payment arrangement");
  if (!record.confirmations.sellerInformationReviewed) missing.push("Seller information reviewed confirmation");
  if (!record.confirmations.buyerInformationReviewed) missing.push("Buyer information reviewed confirmation");
  if (!record.confirmations.vehicleInformationReviewed) missing.push("Vehicle information reviewed confirmation");
  if (!record.confirmations.noVicRoadsTransferAcknowledged) missing.push("VicRoads transfer acknowledgement");
  if (!record.confirmations.termsProvided) missing.push("Terms page availability confirmation");

  return missing;
}

export function canSaleHandoverBeSigned(record: SaleHandoverRecord | Omit<SaleHandoverRecord, "id">) {
  return getSaleHandoverMissingRequiredFields(record).length === 0;
}

export function getSaleHandoverStatusLabel(status: SaleHandoverRecordStatus) {
  const labels: Record<SaleHandoverRecordStatus, string> = {
    draft: "Draft",
    ready_for_signature: "Ready for signature",
    partially_signed: "Partially signed",
    signed: "Signed",
    superseded: "Superseded",
  };
  return labels[status] ?? "Draft";
}

export function buildSaleHandoverVerificationUrl(record: Pick<SaleHandoverRecord, "id">) {
  return `/sale-handover/verify/${encodeURIComponent(record.id)}`;
}

export function buildSaleHandoverHashPayload(record: SaleHandoverRecord | Omit<SaleHandoverRecord, "id">) {
  return JSON.stringify({
    recordNumber: record.recordNumber,
    documentVersion: record.documentVersion,
    agreementTermsVersion: record.agreementTermsVersion,
    status: record.status,
    sellerSignature: record.sellerSignature
      ? {
          signedAt: record.sellerSignature.signedAt,
          signerName: record.sellerSignature.signerName,
          documentVersion: record.sellerSignature.documentVersion,
        }
      : null,
    buyerSignature: record.buyerSignature
      ? {
          signedAt: record.buyerSignature.signedAt,
          signerName: record.buyerSignature.signerName,
          documentVersion: record.buyerSignature.documentVersion,
        }
      : null,
    vehicle: {
      year: record.vehicle.year,
      make: record.vehicle.make,
      model: record.vehicle.model,
      vinOrChassis: record.vehicle.vinOrChassis,
      registrationNumber: record.vehicle.registrationNumber,
    },
  });
}

export async function calculateSaleHandoverDocumentHash(record: SaleHandoverRecord | Omit<SaleHandoverRecord, "id">) {
  const payload = buildSaleHandoverHashPayload(record);
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    let hash = 0;
    for (let index = 0; index < payload.length; index += 1) {
      hash = ((hash << 5) - hash + payload.charCodeAt(index)) | 0;
    }
    return `fallback-${Math.abs(hash).toString(16)}`;
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getCurrentSaleHandoverPdf(record: SaleHandoverRecord) {
  return record.pdf?.storagePath ? record.pdf : null;
}

export function withCalculatedSaleHandoverBalance<T extends { transaction: SaleHandoverTransactionDetails }>(record: T): T {
  return {
    ...record,
    transaction: {
      ...record.transaction,
      balance: calculateSaleHandoverBalance(record.transaction),
    },
  };
}

export function getListingReferenceFromSaleHandover(record: SaleHandoverRecord, listing?: Vehicle | null) {
  if (listing) return getVehicleDisplayReference(listing);
  return record.vehicle.listingReference || (record.listingId ? getVehicleDisplayReference(record.listingId) : "Listing");
}

export function isSaleHandoverMaterialField(path: string) {
  return [
    "seller.legalName",
    "buyer.legalFirstName",
    "buyer.legalFamilyName",
    "buyer.companyLegalName",
    "buyer.authorisedRepresentativeName",
    "vehicle.vinOrChassis",
    "vehicle.registrationNumber",
    "vehicle.registrationStatus",
    "transaction.purchasePrice",
    "transaction.paymentMethod",
    "transaction.paymentArrangement",
    "transaction.handoverDate",
    "transaction.handoverTime",
    "transaction.handoverLocation",
  ].includes(path);
}

function readByPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function getChangedMaterialSaleHandoverFields(previous: SaleHandoverRecord, next: SaleHandoverRecord | Omit<SaleHandoverRecord, "id">) {
  return [
    "seller.legalName",
    "buyer.legalFirstName",
    "buyer.legalFamilyName",
    "buyer.companyLegalName",
    "buyer.authorisedRepresentativeName",
    "vehicle.vinOrChassis",
    "vehicle.registrationNumber",
    "vehicle.registrationStatus",
    "transaction.purchasePrice",
    "transaction.paymentMethod",
    "transaction.paymentArrangement",
    "transaction.handoverDate",
    "transaction.handoverTime",
    "transaction.handoverLocation",
  ].filter((path) => JSON.stringify(readByPath(previous, path) ?? "") !== JSON.stringify(readByPath(next, path) ?? ""));
}

export function isSaleHandoverSignedOrPartiallySigned(record: Pick<SaleHandoverRecord, "sellerSignature" | "buyerSignature">) {
  return Boolean(record.sellerSignature?.signatureStoragePath || record.buyerSignature?.signatureStoragePath);
}

export function buildSaleHandoverPdfFileName(record: SaleHandoverRecord, pdf?: SaleHandoverPdfSnapshot | null) {
  const version = pdf?.documentVersion ?? record.documentVersion;
  return `${record.recordNumber.toLowerCase()}-v${version}.pdf`;
}
