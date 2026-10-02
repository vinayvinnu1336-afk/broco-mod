export interface CustomerVehicle {
  id: string;
  manufacturerName: string;
  modelName: string;
  variantName?: string | null;
  year: number;
  fuelType: string;
  transmission: string;
  licensePlate: string;
  vin?: string | null;
  currentOdometerKm: number;
  color?: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export interface ServiceLocationDto {
  id: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface CreateServiceBookingRequest {
  vehicleId: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number;
  longitude: number;
  problemDescription: string;
  serviceCategory?: string;
  preferredServiceDate?: string | null;
}

export interface ServiceRequestDetailDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  customerVehicleId?: string | null;
  vehicleSummary: string;
  vehicleLicensePlate: string;
  serviceLocation: ServiceLocationDto;
  problemDescription: string;
  serviceCategory: string;
  preferredServiceDate?: string | null;
  status: string;
  assignedAdvisorId?: string | null;
  assignedAdvisorName?: string | null;
  matchedGaragesCount: number;
  submittedAtUtc: string;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
}

export interface CustomerServiceRequestSummaryDto {
  id: string;
  requestNumber: string;
  vehicleSummary: string;
  licensePlate: string;
  locationSummary: string;
  problemDescription: string;
  status: string;
  createdAtUtc: string;
  submittedAtUtc: string;
  quotesCount: number;
}

export interface GarageIncomingRequestDto {
  garageRequestId: string;
  serviceRequestId: string;
  requestNumber: string;
  vehicleSummary: string;
  problemDescription: string;
  locationArea: string;
  distanceKm: number;
  status: string;
  sentAtUtc: string;
}

export interface GarageIncomingRequestDetailDto {
  garageRequestId: string;
  serviceRequestId: string;
  requestNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleLicensePlate: string;
  problemDescription: string;
  serviceCategory: string;
  preferredServiceDate?: string | null;
  locationArea: string;
  distanceKm: number;
  status: string;
  sentAtUtc: string;
  viewedAtUtc?: string | null;
  respondedAtUtc?: string | null;
}

export interface DispatchedGarageSummaryDto {
  garageRequestId: string;
  garageId: string;
  garageName: string;
  garagePhone: string;
  distanceKm: number;
  status: string;
  notifiedAtUtc: string;
}

export interface AdvisorServiceRequestSummaryDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleSummary: string;
  locationSummary: string;
  problemDescription: string;
  serviceCategory: string;
  status: string;
  matchedGaragesCount: number;
  notifiedGaragesCount: number;
  submittedAtUtc: string;
}

export interface AdvisorServiceRequestDetailDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleSummary: string;
  vehicleLicensePlate: string;
  serviceLocation: ServiceLocationDto;
  problemDescription: string;
  serviceCategory: string;
  preferredServiceDate?: string | null;
  status: string;
  assignedAdvisorId?: string | null;
  dispatchedGarages: DispatchedGarageSummaryDto[];
  submittedAtUtc: string;
}

export interface AdminServiceRequestSummaryDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  vehicleSummary: string;
  locationSummary: string;
  status: string;
  assignedAdvisorName?: string | null;
  matchedGaragesCount: number;
  notifiedGaragesCount: number;
  submittedAtUtc: string;
}

export interface AdminServiceRequestDetailDto {
  id: string;
  requestNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleSummary: string;
  vehicleLicensePlate: string;
  serviceLocation: ServiceLocationDto;
  problemDescription: string;
  serviceCategory: string;
  preferredServiceDate?: string | null;
  status: string;
  assignedAdvisorId?: string | null;
  assignedAdvisorName?: string | null;
  dispatchedGarages: DispatchedGarageSummaryDto[];
  submittedAtUtc: string;
  cancelledAtUtc?: string | null;
  cancellationReason?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
