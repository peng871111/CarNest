import { AdminPermissionKey, Vehicle } from "@/types";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/inventory", label: "Browse Cars" },
  { href: "/sold", label: "Sold Cars" },
  { href: "/sell", label: "Sell Your Car" },
  { href: "/about", label: "About Us" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact Us" }
];

export const ADMIN_LINKS: Array<{ href: string; label: string; permission?: AdminPermissionKey }> = [
  { href: "/admin/vehicles", label: "Vehicle Management", permission: "manageVehicles" },
  { href: "/admin/vehicles/add", label: "Add Vehicle", permission: "manageVehicles" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/compliance", label: "Compliance", permission: "manageUsers" },
  { href: "/admin/dealer-applications", label: "Dealer Applications", permission: "manageUsers" },
  { href: "/admin/warehouse-intake", label: "Warehouse Intake", permission: "manageVehicles" },
  { href: "/admin/user-support", label: "User Support", permission: "manageUsers" },
  { href: "/admin/inspections", label: "Inspections", permission: "manageInspections" },
  { href: "/admin/enquiries", label: "Enquiries", permission: "manageEnquiries" },
  { href: "/admin/pricing", label: "Pricing", permission: "managePricing" },
  { href: "/admin/quotes", label: "Quotes", permission: "manageQuotes" },
  { href: "/admin/offers", label: "Offers", permission: "manageOffers" },
  { href: "/admin/users", label: "Admin Access", permission: "manageAdmins" }
];

export const SELLER_LINKS = [
  { href: "/seller/vehicles", label: "My Vehicles" },
  { href: "/dashboard/saved", label: "Saved Vehicles" },
  { href: "/seller/vehicles/new", label: "Add Vehicle" },
  { href: "/seller/offers", label: "Offers on My Cars" },
  { href: "/dashboard/offers", label: "My Offers to Sellers" }
];

export const VEHICLE_PLACEHOLDER_IMAGE = "/vehicle-placeholder.svg";
export const DEFAULT_FINANCE_INTEREST_RATE = 8.99;

export const sampleVehicles: Vehicle[] = [
  {
    id: "veh-001",
    sellerId: "seller-demo-1",
    ownerUid: "seller-demo-1",
    ownerRole: "seller",
    listingType: "warehouse",
    status: "approved",
    sellerStatus: "ACTIVE",
    ownershipVerified: true,
    publishAuthorized: true,
    approvedAt: "2026-04-01T09:00:00.000Z",
    storedInWarehouse: true,
    warehouseAddress: "12 Foundry Lane, Dandenong South VIC",
    make: "Porsche",
    model: "911",
    variant: "Carrera S",
    year: 2022,
    price: 248000,
    mileage: 9200,
    transmission: "PDK",
    fuelType: "Petrol",
    drivetrain: "RWD",
    bodyType: "Coupe",
    colour: "GT Silver",
    vin: "WP0ZZZ99ZNS100001",
    rego: "CARNEST1",
    description: "Warehouse-kept and professionally presented with inspection access managed through CarNest approval handling in a later phase.",
    features: ["Sport Chrono", "BOSE audio", "Adaptive cruise"],
    conditionNotes: "As-new inside and out.",
    serviceHistory: "FULL DEALER SERVICE HISTORY",
    keyCount: "2 KEYS",
    coverImageUrl:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80"
    ],
    images: [
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80"
    ],
    createdAt: "2026-04-01",
    updatedAt: "2026-04-01"
  },
  {
    id: "veh-002",
    sellerId: "seller-demo-2",
    ownerUid: "seller-demo-2",
    ownerRole: "seller",
    listingType: "private",
    status: "approved",
    sellerStatus: "ACTIVE",
    ownershipVerified: true,
    publishAuthorized: true,
    approvedAt: "2026-03-28T09:00:00.000Z",
    storedInWarehouse: false,
    sellerLocationSuburb: "Brighton",
    sellerLocationState: "VIC",
    make: "BMW",
    model: "M3",
    variant: "Competition",
    year: 2021,
    price: 129900,
    mileage: 22100,
    transmission: "Automatic",
    fuelType: "Petrol",
    drivetrain: "AWD",
    bodyType: "Sedan",
    colour: "Frozen Black",
    vin: "WBS12AY0200M30002",
    rego: "CARNEST2",
    description: "Privately stored and presented online through CarNest with suburb-level privacy protection and no exact address shown publicly.",
    features: ["Carbon bucket seats", "Laser lights", "Head-up display"],
    conditionNotes: "Minor stone chips on lower front fascia.",
    serviceHistory: "PARTIAL DEALER SERVICE HISTORY",
    keyCount: "2 KEYS",
    coverImageUrl:
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80"
    ],
    images: [
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80"
    ],
    createdAt: "2026-03-28",
    updatedAt: "2026-03-28"
  },
  {
    id: "veh-003",
    sellerId: "seller-demo-3",
    ownerUid: "seller-demo-3",
    ownerRole: "seller",
    listingType: "warehouse",
    status: "approved",
    sellerStatus: "SOLD",
    ownershipVerified: true,
    publishAuthorized: true,
    approvedAt: "2026-03-10T09:00:00.000Z",
    storedInWarehouse: true,
    warehouseAddress: "CarNest Secure Warehouse",
    make: "MERCEDES-BENZ",
    model: "G63",
    variant: "AMG",
    year: 2020,
    price: 289000,
    mileage: 18400,
    transmission: "AT",
    fuelType: "PETROL",
    drivetrain: "AWD",
    bodyType: "SUV",
    colour: "OBSIDIAN BLACK",
    vin: "WDCYC7HJ0LX300003",
    rego: "CARNEST3",
    description: "Previously sold through CarNest with managed storage, curated presentation, and appointment-based inspections.",
    features: ["Burmester audio", "Night package", "Surround view camera"],
    conditionNotes: "Presented in excellent condition at sale.",
    serviceHistory: "FULL DEALER SERVICE HISTORY",
    keyCount: "2 KEYS",
    coverImageUrl:
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
    imageUrls: [
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80"
    ],
    images: [
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80"
    ],
    soldAt: "2026-03-22T10:30:00.000Z",
    createdAt: "2026-03-10",
    updatedAt: "2026-03-22"
  }
];
