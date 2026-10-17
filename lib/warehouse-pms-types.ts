export const WAREHOUSE_PMS_BOOKING_STATUSES = [
  "draft",
  "reserved",
  "confirmed",
  "checked_in",
  "extended",
  "due_out",
  "overdue",
  "checked_out",
  "cancelled",
  "no_show"
] as const;

export type WarehousePmsBookingStatus = (typeof WAREHOUSE_PMS_BOOKING_STATUSES)[number];
export type WarehousePmsBayBaseState = "available" | "temporarily_blocked" | "maintenance";
export type WarehousePmsOccupancySourceType = "managed_vehicle" | "internal" | "listing";

export interface WarehousePmsSettings {
  id: string;
  defaultMonthlyRate: number;
  defaultDailyRate: number;
  bayCapacity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehousePmsBay {
  id: string;
  label: string;
  sequence: number;
  baseState: WarehousePmsBayBaseState;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehousePmsCustomerSummary {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface WarehousePmsVehicleSummary {
  id: string;
  source: "vehicle" | "vehicle_record";
  title: string;
  year?: string;
  make?: string;
  model?: string;
  variant?: string;
  rego?: string;
  vin?: string;
  vehicleReference?: string;
  customerProfileId?: string;
}

export interface WarehousePmsManagedVehicle extends WarehousePmsVehicleSummary {
  occupiedFrom?: string;
}

export interface WarehousePmsBooking {
  id: string;
  reference: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleId?: string;
  vehicleSource?: WarehousePmsVehicleSummary["source"];
  vehicleTitle: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleVariant?: string;
  vehicleRego?: string;
  vehicleVin?: string;
  vehicleReference?: string;
  linkedStorageContractId?: string;
  plannedCheckInAt: string;
  plannedCollectionAt: string;
  originalPlannedCollectionAt?: string;
  actualCheckInAt?: string;
  actualCollectionAt?: string;
  assignedBayId?: string;
  monthlyRate: number;
  dailyRate: number;
  rateOverride: boolean;
  manualBillingOverride?: number;
  additionalStorageCharges: number;
  status: WarehousePmsBookingStatus;
  notes?: string;
  createdBy: string;
  checkedInBy?: string;
  checkedOutBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehousePmsExtension {
  id: string;
  bookingId: string;
  bookingReference: string;
  previousPlannedCollectionAt: string;
  newPlannedCollectionAt: string;
  extensionDays: number;
  additionalEstimatedCharge: number;
  requestedAt: string;
  approvedBy: string;
  createdAt?: string;
}

export interface WarehousePmsOccupancy {
  id: string;
  sourceType: WarehousePmsOccupancySourceType;
  sourceId: string;
  bayId?: string;
  label: string;
  rego?: string;
  vehicleReference?: string;
  occupiedFrom: string;
  plannedDepartureAt?: string | null;
  releasedAt?: string;
  releasedBy?: string;
  notes?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehousePmsLinkedContract {
  id: string;
  vehicleId?: string;
  vehicleRecordId?: string;
  reference?: string;
  status?: string;
}

export interface WarehousePmsSnapshot {
  settings: WarehousePmsSettings;
  bays: WarehousePmsBay[];
  bookings: WarehousePmsBooking[];
  extensions: WarehousePmsExtension[];
  occupancies: WarehousePmsOccupancy[];
  managedVehicles: WarehousePmsManagedVehicle[];
  customers: WarehousePmsCustomerSummary[];
  vehicles: WarehousePmsVehicleSummary[];
  linkedContracts: WarehousePmsLinkedContract[];
  generatedAt: string;
}
